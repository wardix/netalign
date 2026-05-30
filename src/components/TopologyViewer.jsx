// src/components/TopologyViewer.jsx
import React, { useEffect, useState, useCallback } from 'react';
import ReactFlow, { MiniMap, Controls, Background, useReactFlow } from 'reactflow';
import 'reactflow/dist/style.css';
// Dynamically import topology data to reflect live changes
// (static import can be cached by Vite HMR, causing stale nodes)


// Import only the three desired custom node components
import SubnetNode from '../nodes/SubnetNode';
import RouterNode from '../nodes/RouterNode';
import InstanceNode from '../nodes/InstanceNode';

// Register node types that mimic OpenStack Horizon appearance (only three)
const nodeTypes = {
  subnet: SubnetNode,
  router: RouterNode,
  instance: InstanceNode,
};

export default function TopologyViewer() {
  const { fitView } = useReactFlow();
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  // Load JSON data once (could be fetched from an API later)
  useEffect(() => {
    // Dynamically load the JSON each time the component mounts
    import('../data/topology.json')
      .then((module) => {
        const { nodes: jsonNodes, edges: jsonEdges } = module.default;
        setNodes(jsonNodes);
        setEdges(jsonEdges);
        // Auto‑fit after nodes are set
        setTimeout(() => fitView({ padding: 0.2 }), 0);
      })
      .catch((err) => {
        console.error('Failed to load topology data:', err);
      });
  }, [fitView]);

  // Simple tooltip on node click (mirroring Horizon's pop‑up info)
  const onNodeClick = useCallback((event, node) => {
    const info = `Type: ${node.type}\nLabel: ${node.data.label}`;
    alert(info);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        attributionPosition="top-right"
        // Use a hierarchical layout similar to Horizon (breadthfirst) – optional
        layout={{ name: 'breadthfirst', directed: true, padding: 10 }}
      >
        <MiniMap
          nodeColor={(n) => {
            switch (n.type) {
              case 'subnet':   return '#F5A623';
              case 'router':   return '#BD10E0';
              case 'instance': return '#D0021B';
              default: return '#888';
            }
          }}
        />
        <Controls />
        <Background variant="dots" gap={12} />
      </ReactFlow>
    </div>
  );
}
