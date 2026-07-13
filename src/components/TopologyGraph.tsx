// src/components/TopologyGraph.tsx
import React, { useEffect, useState, useRef } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import type { TopologyNode } from '../../shared/topologyNodes.ts';

interface TopologyEdge {
  id: string;
  source: string;
  target: string;
}

interface GraphNode extends TopologyNode {
  label?: string;
}

const getNodeLabel = (node: GraphNode) => node.data?.label || node.label || node.id;

interface TopologyGraphProps {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  onNodeSelect?: (nodeId: string) => void;
  onEdgeSelect?: (edgeId: string) => void;
}

function buildGraphElements(nodes: GraphNode[], edges: TopologyEdge[]) {
  const SUBNET_PALETTE = ['#F5A623', '#50E3C2', '#4A90E2', '#7ED321', '#E67E22', '#1ABC9C'];
  const ROUTER_COLOR = '#BD10E0';
  const INSTANCE_COLOR = '#FF6B6B';
  const SUBNET_HEIGHT = 200;
  const SUBNET_Y = 300;

  const subnets = nodes.filter(n => n.type === 'subnet');
  const routers = nodes.filter(n => n.type === 'router');
  const instances = nodes.filter(n => n.type === 'instance' || n.type === 'vm');

  const subnetColors: Record<string, string> = {};
  subnets.forEach((s, i) => {
    subnetColors[s.id] = SUBNET_PALETTE[i % SUBNET_PALETTE.length];
  });

  const subnetLeftNodes: Record<string, string[]> = {};
  const subnetRightNodes: Record<string, string[]> = {};
  subnets.forEach(s => {
    subnetLeftNodes[s.id] = [];
    subnetRightNodes[s.id] = [];
  });
  const routerConnectedSubnets: Record<string, string[]> = {};
  routers.forEach(r => {
    routerConnectedSubnets[r.id] = [];
  });
  const instanceConnectedSubnets: Record<string, string[]> = {};
  instances.forEach(i => {
    instanceConnectedSubnets[i.id] = [];
  });

  edges.forEach(e => {
    const src = nodes.find(n => n.id === e.source);
    const tgt = nodes.find(n => n.id === e.target);
    if (!src || !tgt) return;
    if (src.type === 'router' && tgt.type === 'subnet') routerConnectedSubnets[src.id].push(tgt.id);
    else if (src.type === 'subnet' && tgt.type === 'router') routerConnectedSubnets[tgt.id].push(src.id);
    else if (src.type === 'instance' && tgt.type === 'subnet') instanceConnectedSubnets[src.id].push(tgt.id);
    else if (src.type === 'subnet' && tgt.type === 'instance') instanceConnectedSubnets[tgt.id].push(src.id);
  });

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

  instances.forEach(inst => {
    const con = instanceConnectedSubnets[inst.id];
    if (con.length >= 1) {
      const subnetId = con[0];
      if (subnetRightNodes[subnetId]) subnetRightNodes[subnetId].push(inst.id);
    }
  });

  const pos: Record<string, { x: number; y: number }> = {};
  subnets.forEach((s, idx) => {
    const x = 320 + idx * 350;
    pos[s.id] = { x, y: SUBNET_Y };
  });

  const subnetEndpoints: Record<string, Record<string, { side: string; offset: number }>> = {};
  subnets.forEach(s => {
    subnetEndpoints[s.id] = {};
  });

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

  const cyElements: any[] = [];
  subnets.forEach(s => {
    cyElements.push({
      data: {
        id: s.id,
        label: getNodeLabel(s),
        type: 'subnet',
        color: subnetColors[s.id],
        shape: 'round-rectangle',
        width: 20,
        height: SUBNET_HEIGHT,
      },
      position: pos[s.id],
    });
  });
  routers.forEach(r => {
    cyElements.push({
      data: {
        id: r.id,
        label: getNodeLabel(r),
        type: 'router',
        color: ROUTER_COLOR,
        shape: 'diamond',
        width: 60,
        height: 60,
      },
      position: pos[r.id],
    });
  });
  instances.forEach(i => {
    cyElements.push({
      data: {
        id: i.id,
        label: getNodeLabel(i),
        type: 'instance',
        color: INSTANCE_COLOR,
        shape: 'round-rectangle',
        width: 90,
        height: 36,
      },
      position: pos[i.id],
    });
  });

  const edgeStyles: any[] = [];
  edges.forEach(e => {
    const edgeId = e.id || `e-${e.source}-${e.target}`;
    cyElements.push({ data: { id: edgeId, source: e.source, target: e.target } });
    const srcNode = nodes.find(n => n.id === e.source);
    const tgtNode = nodes.find(n => n.id === e.target);
    if (!srcNode || !tgtNode) return;
    let subnetNode;
    let peerNode;
    let subnetIsSource;
    if (srcNode.type === 'subnet') {
      subnetNode = srcNode;
      peerNode = tgtNode;
      subnetIsSource = true;
    } else if (tgtNode.type === 'subnet') {
      subnetNode = tgtNode;
      peerNode = srcNode;
      subnetIsSource = false;
    } else return;
    const subnetId = subnetNode.id;
    const peerId = peerNode.id;
    const subnetColor = subnetColors[subnetId];
    const endpointInfo = subnetEndpoints[subnetId][peerId];
    if (!endpointInfo) return;
    const subnetYOffset = endpointInfo.offset;
    const side = endpointInfo.side;
    const subnetXOffsetVal = side === 'left' ? -10 : 10;
    const subnetEndpointStr = `${subnetXOffsetVal}px ${subnetYOffset}px`;
    const peerEndpointStr =
      peerNode.type === 'router'
        ? side === 'left'
          ? '30px 0px'
          : '-30px 0px'
        : side === 'left'
          ? '45px 0px'
          : '-45px 0px';
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
      },
    });
  });

  const routerSvg =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="%23BD10E0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 18 22 12 16 6"/>
            <polyline points="8 6 2 12 8 18"/>
            <line x1="12" y1="2" x2="12" y2="22"/>
          </svg>
        `);
  const instanceSvg =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="90" height="36" viewBox="0 0 24 24" fill="none" stroke="%23FF6B6B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
            <line x1="6" y1="6" x2="6.01" y2="6"/>
            <line x1="6" y1="18" x2="6.01" y2="18"/>
          </svg>
        `);

  const styles = [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'background-color': 'data(color)',
        shape: 'data(shape)',
        width: 'data(width)',
        height: 'data(height)',
        'text-valign': 'bottom',
        'text-halign': 'center',
        'font-size': 10,
        'font-weight': 'bold',
        color: '#cfd8dc',
        'text-margin-y': 8,
        'text-wrap': 'wrap',
        'text-max-width': 120,
        'border-width': 2.5,
        'border-color': 'rgba(255,255,255,0.1)',
        'border-style': 'solid',
        'transition-property': 'background-color border-color text-color',
        'transition-duration': '0.2s',
        'background-fit': 'contain',
        'background-clip': 'node',
      },
    },
    {
      selector: 'node[type="router"]',
      style: {
        'background-image': routerSvg,
        'background-color': '#1a1d24',
        'border-color': '#BD10E0',
      },
    },
    {
      selector: 'node[type="instance"]',
      style: {
        'background-image': instanceSvg,
        'background-color': '#1a1d24',
        'border-color': '#FF6B6B',
      },
    },
    {
      selector: 'node[type="subnet"]',
      style: { 'border-color': 'rgba(255,255,255,0.2)', 'background-opacity': 0.85 },
    },
    { selector: 'node:selected', style: { 'border-color': '#fff', 'border-width': 3, color: '#ffffff' } },
    { selector: 'edge:selected', style: { width: 4.5, 'line-color': '#fff' } },
    ...edgeStyles,
  ];

  return { elements: cyElements, styles };
}

const TopologyGraph: React.FC<TopologyGraphProps> = ({ nodes, edges, onNodeSelect, onEdgeSelect }) => {
  const [elements, setElements] = useState<any[]>([]);
  const [styles, setStyles] = useState<any[]>([]);
  const cyRef = useRef<any>(null);

  useEffect(() => {
    const { elements: cyElements, styles: cyStyles } = buildGraphElements(nodes, edges);
    setElements(cyElements);
    setStyles(cyStyles);
  }, [nodes, edges]);

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

  const handleZoomIn = () => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() * 1.2);
    }
  };

  const handleZoomOut = () => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() / 1.2);
    }
  };

  const handleFit = () => {
    if (cyRef.current) {
      cyRef.current.fit();
      cyRef.current.center();
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <CytoscapeComponent
        elements={elements}
        style={{ width: '100%', height: '100%' }}
        stylesheet={styles}
        layout={{ name: 'preset' }}
        cy={cy => {
          cyRef.current = cy;
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          zIndex: 1000,
          background: 'rgba(255, 255, 255, 0.8)',
          padding: '6px 10px',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(0, 0, 0, 0.06)',
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleZoomIn}
            style={{
              width: 32,
              height: 32,
              borderRadius: 4,
              border: '1px solid #d9d9d9',
              background: '#fff',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 0 rgba(0,0,0,0.015)',
            }}
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            style={{
              width: 32,
              height: 32,
              borderRadius: 4,
              border: '1px solid #d9d9d9',
              background: '#fff',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 0 rgba(0,0,0,0.015)',
            }}
            title="Zoom Out"
          >
            -
          </button>
          <button
            onClick={handleFit}
            style={{
              padding: '0 10px',
              height: 32,
              borderRadius: 4,
              border: '1px solid #d9d9d9',
              background: '#fff',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 0 rgba(0,0,0,0.015)',
            }}
            title="Fit to Center"
          >
            Fit
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopologyGraph;