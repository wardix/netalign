// src/components/TopologyGraph.tsx
import React, { useEffect, useState, useRef } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import { API_BASE } from '../api';

interface Node {
  id: string;
  type: string;
  label?: string;
  data: any;
}
interface Edge {
  id: string;
  source: string;
  target: string;
}
interface Topology {
  nodes: Node[];
  edges: Edge[];
}

interface TopologyGraphProps {
  activeTopologyId: string | null;
  triggerRefresh: number;
  onNodeSelect?: (nodeId: string) => void;
  onEdgeSelect?: (edgeId: string) => void;
}

const TopologyGraph: React.FC<TopologyGraphProps> = ({ activeTopologyId, triggerRefresh, onNodeSelect, onEdgeSelect }) => {
  const [elements, setElements] = useState<any[]>([]);
  const [styles, setStyles] = useState<any[]>([]);
  const cyRef = useRef<any>(null);

  // Load topology and compute layout
  useEffect(() => {
    if (!activeTopologyId) return;
    fetch(`${API_BASE}/api/topologies/${activeTopologyId}`)
      .then(res => res.json())
      .then((data: Topology) => {
        // ---- Layout computation mirroring original script.js ----
        const SUBNET_PALETTE = ['#F5A623', '#50E3C2', '#4A90E2', '#7ED321', '#E67E22', '#1ABC9C'];
        const ROUTER_COLOR = '#BD10E0';
        const INSTANCE_COLOR = '#FF6B6B';
        const SUBNET_HEIGHT = 200;
        const SUBNET_Y = 300;

        const nodes = data.nodes;
        const edges = data.edges;

        const subnets = nodes.filter(n => n.type === 'subnet');
        const routers = nodes.filter(n => n.type === 'router');
        const instances = nodes.filter(n => n.type === 'instance' || n.type === 'vm');

        // Assign colors to subnets
        const subnetColors: Record<string, string> = {};
        subnets.forEach((s, i) => {
          const color = SUBNET_PALETTE[i % SUBNET_PALETTE.length];
          subnetColors[s.id] = color;
        });

        // Helper maps for adjacency
        const subnetLeftNodes: Record<string, string[]> = {};
        const subnetRightNodes: Record<string, string[]> = {};
        subnets.forEach(s => { subnetLeftNodes[s.id] = []; subnetRightNodes[s.id] = []; });
        const routerConnectedSubnets: Record<string, string[]> = {};
        routers.forEach(r => { routerConnectedSubnets[r.id] = []; });
        const instanceConnectedSubnets: Record<string, string[]> = {};
        instances.forEach(i => { instanceConnectedSubnets[i.id] = []; });

        // Populate adjacency based on edges
        edges.forEach(e => {
          const src = nodes.find(n => n.id === e.source);
          const tgt = nodes.find(n => n.id === e.target);
          if (!src || !tgt) return;
          if (src.type === 'router' && tgt.type === 'subnet') routerConnectedSubnets[src.id].push(tgt.id);
          else if (src.type === 'subnet' && tgt.type === 'router') routerConnectedSubnets[tgt.id].push(src.id);
          else if (src.type === 'instance' && tgt.type === 'subnet') instanceConnectedSubnets[src.id].push(tgt.id);
          else if (src.type === 'subnet' && tgt.type === 'instance') instanceConnectedSubnets[tgt.id].push(src.id);
        });

        // Classify routers
        const multiSubnetRouters: string[] = [];
        routers.forEach(r => {
          const con = routerConnectedSubnets[r.id];
          if (con.length === 1) {
            const subnetId = con[0];
            if (subnetLeftNodes[subnetId]) subnetLeftNodes[subnetId].push(r.id);
          } else if (con.length > 1) {
            multiSubnetRouters.push(r.id);
          }
        });

        // Assign instances to right side of subnets
        instances.forEach(inst => {
          const con = instanceConnectedSubnets[inst.id];
          if (con.length >= 1) {
            const subnetId = con[0];
            if (subnetRightNodes[subnetId]) subnetRightNodes[subnetId].push(inst.id);
          }
        });

        // Position map
        const pos: Record<string, { x: number; y: number }> = {};
        // Horizontal placement of subnets
        subnets.forEach((s, idx) => {
          const x = 320 + idx * 350;
          pos[s.id] = { x, y: SUBNET_Y };
        });

        // Track endpoint offsets for edge styling
        const subnetEndpoints: Record<string, Record<string, { side: string; offset: number }>> = {};
        subnets.forEach(s => { subnetEndpoints[s.id] = {}; });

        // Left‑side routers (single‑subnet)
        subnets.forEach(s => {
          const left = subnetLeftNodes[s.id];
          const n = left.length;
          const baseX = pos[s.id].x - 200;
          left.forEach((id, i) => {
            let y = SUBNET_Y;
            if (n > 1) {
              y = SUBNET_Y - SUBNET_HEIGHT / 2 + (SUBNET_HEIGHT / (n + 1)) * (i + 1);
            }
            pos[id] = { x: baseX, y };
            subnetEndpoints[s.id][id] = { side: 'left', offset: y - SUBNET_Y };
          });
        });

        // Right‑side instances
        subnets.forEach((s, idx) => {
          const right = subnetRightNodes[s.id];
          const n = right.length;
          const baseX = idx === subnets.length - 1 ? pos[s.id].x + 200 : pos[s.id].x + 150;
          right.forEach((id, i) => {
            let y = SUBNET_Y;
            if (n > 1) {
              y = SUBNET_Y - SUBNET_HEIGHT / 2 + (SUBNET_HEIGHT / (n + 1)) * (i + 1);
            }
            pos[id] = { x: baseX, y };
            subnetEndpoints[s.id][id] = { side: 'right', offset: y - SUBNET_Y };
          });
        });

        // Multi‑subnet routers (center)
        const multiSlots = [360, 240, 300, 200, 400];
        multiSubnetRouters.forEach((id, i) => {
          const con = routerConnectedSubnets[id];
          const avgX = con.reduce((sum, sid) => sum + (pos[sid]?.x || 0), 0) / con.length || 450;
          const y = multiSlots[i % multiSlots.length];
          pos[id] = { x: avgX, y };
          con.forEach(sid => {
            const side = pos[id].x < pos[sid].x ? 'left' : 'right';
            subnetEndpoints[sid][id] = { side, offset: y - SUBNET_Y };
          });
        });

        // Build Cytoscape elements
        const cyElements: any[] = [];
        subnets.forEach(s => {
          cyElements.push({
            data: { id: s.id, label: s.label || s.id, type: 'subnet', color: subnetColors[s.id], shape: 'round-rectangle', width: 20, height: SUBNET_HEIGHT },
            position: pos[s.id]
          });
        });
        routers.forEach(r => {
          cyElements.push({
            data: { id: r.id, label: r.label || r.id, type: 'router', color: ROUTER_COLOR, shape: 'diamond', width: 60, height: 60 },
            position: pos[r.id]
          });
        });
        instances.forEach(i => {
          cyElements.push({
            data: { id: i.id, label: i.label || i.id, type: 'instance', color: INSTANCE_COLOR, shape: 'round-rectangle', width: 90, height: 36 },
            position: pos[i.id]
          });
        });

        // Edge elements with custom style
        const edgeStyles: any[] = [];
        edges.forEach(e => {
          const edgeId = e.id || `e-${e.source}-${e.target}`;
          cyElements.push({ data: { id: edgeId, source: e.source, target: e.target } });
          const srcNode = nodes.find(n => n.id === e.source);
          const tgtNode = nodes.find(n => n.id === e.target);
          if (!srcNode || !tgtNode) return;
          let subnetNode, peerNode, subnetIsSource;
          if (srcNode.type === 'subnet') { subnetNode = srcNode; peerNode = tgtNode; subnetIsSource = true; }
          else if (tgtNode.type === 'subnet') { subnetNode = tgtNode; peerNode = srcNode; subnetIsSource = false; }
          else return;
          const subnetId = subnetNode.id;
          const peerId = peerNode.id;
          const subnetColor = subnetColors[subnetId];
          const endpointInfo = subnetEndpoints[subnetId][peerId];
          if (!endpointInfo) return;
          const subnetYOffset = endpointInfo.offset;
          const side = endpointInfo.side;
          const subnetXOffsetVal = side === 'left' ? -10 : 10;
          const subnetEndpointStr = `${subnetXOffsetVal}px ${subnetYOffset}px`;
          const peerEndpointStr = peerNode.type === 'router' ? (side === 'left' ? '30px 0px' : '-30px 0px') : (side === 'left' ? '45px 0px' : '-45px 0px');
          const sourceEndpoint = subnetIsSource ? subnetEndpointStr : peerEndpointStr;
          const targetEndpoint = subnetIsSource ? peerEndpointStr : subnetEndpointStr;
          edgeStyles.push({
            selector: `#${edgeId}`,
            style: {
              width: 2.5,
              'line-color': subnetColor,
              'curve-style': 'straight',
              'source-endpoint': sourceEndpoint,
              'target-endpoint': targetEndpoint,
            }
          });
        });

        setElements(cyElements);
        setStyles([
          { selector: 'node', style: { label: 'data(label)', 'background-color': 'data(color)', shape: 'data(shape)', width: 'data(width)', height: 'data(height)', 'text-valign': 'bottom', 'text-halign': 'center', 'font-size': 10, 'font-weight': 'bold', color: '#cfd8dc', 'text-margin-y': 8, 'text-wrap': 'wrap', 'text-max-width': 120, 'border-width': 2.5, 'border-color': 'rgba(255,255,255,0.1)', 'border-style': 'solid', 'transition-property': 'background-color border-color text-color', 'transition-duration': '0.2s' } },
          { selector: 'node:selected', style: { 'border-color': '#fff', 'border-width': 3, color: '#ffffff' } },
          { selector: 'edge:selected', style: { width: 4.5, 'line-color': '#fff' } },
          ...edgeStyles
        ]);
      })
      .catch(console.error);
  }, [activeTopologyId, triggerRefresh]);

  // Register click handlers for nodes/edges
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const onNodeTap = (evt: any) => {
      const id = evt.target.id();
      if (onNodeSelect) onNodeSelect(id);
    };
    const onEdgeTap = (evt: any) => {
      const id = evt.target.id();
      if (onEdgeSelect) onEdgeSelect(id);
    };
    cy.on('tap', 'node', onNodeTap);
    cy.on('tap', 'edge', onEdgeTap);
    return () => {
      cy.removeListener('tap', 'node', onNodeTap);
      cy.removeListener('tap', 'edge', onEdgeTap);
    };
  }, [elements, onNodeSelect, onEdgeSelect]);

  return (
    <CytoscapeComponent
      elements={elements}
      style={{ width: '100%', height: '100%' }}
      stylesheet={styles}
      layout={{ name: 'preset' }}
      cy={(cy) => { cyRef.current = cy; }}
    />
  );
};

export default TopologyGraph;
