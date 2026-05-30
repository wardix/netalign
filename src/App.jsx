// src/App.jsx
import React from 'react';
import TopologyViewer from './components/TopologyViewer';

function App() {
  return (
    <div style={{ height: '100vh', background: '#0d1117', color: '#c9d1d9' }}>
      <h1 style={{ textAlign: 'center', padding: '1rem', color: '#58a6ff' }}>
        OpenStack‑like Network Topology (React Flow)
      </h1>
      <TopologyViewer />
    </div>
  );
}

export default App;
