// src/nodes/RouterNode.jsx
import React from 'react';
import { Handle } from 'reactflow';
import './NodeStyles.css';

export default function RouterNode({ data }) {
  return (
    <div className="node router-node" style={{ width: '80px', height: '80px' }}>
      <div className="icon">🚀</div>
      <div className="label">{data.label}</div>
      {/* incoming from subnet, outgoing to instance */}
      <Handle type="target" position="top" id="in" />
      <Handle type="source" position="bottom" id="out" />
    </div>
  );
}
