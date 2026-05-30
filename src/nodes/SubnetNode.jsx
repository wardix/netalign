// src/nodes/SubnetNode.jsx
import React from 'react';
import { Handle } from 'reactflow';
import './NodeStyles.css';

export default function SubnetNode({ data }) {
  return (
    <div className="node subnet-node" style={{ width: '30px', height: '150px' }}>
      <div className="icon">🧭</div>
      <div className="label">{data.label}</div>
      {/* incoming from router, outgoing to router (bidirectional visual) */}
      <Handle type="target" position="top" id="in" />
      <Handle type="source" position="bottom" id="out" />
    </div>
  );
}
