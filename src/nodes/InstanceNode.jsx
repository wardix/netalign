// src/nodes/InstanceNode.jsx
import React from 'react';
import { Handle } from 'reactflow';
import './NodeStyles.css';

export default function InstanceNode({ data }) {
  return (
    <div className="node instance-node" style={{ width: '80px', height: '80px' }}>
      <div className="icon">💻</div>
      <div className="label">{data.label}</div>
      {/* Incoming edge from router */}
      <Handle type="target" position="top" id="in" />
    </div>
  );
}
