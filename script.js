// script.js
// Client-side controller for dynamic topology manager.
// Interacts with Bun/Hono Backend API and renders with Cytoscape.js.

let topologies = [];
let activeTopologyId = '';
let activeTopologyData = null;
let selectedNodeId = null;
let selectedEdgeId = null;
let cyInstance = null;

// Premium Color Palettes
const SUBNET_PALETTE = ['#F5A623', '#50E3C2', '#4A90E2', '#7ED321', '#E67E22', '#1ABC9C'];
const ROUTER_COLOR = '#BD10E0'; // Elegant Violet
const INSTANCE_COLOR = '#FF6B6B'; // Elegant Coral Red

document.addEventListener('DOMContentLoaded', function () {
  initUI();
  loadTopologies();
});

// Initialize UI Event Listeners
function initUI() {
  // Topology Select Dropdown change
  document.getElementById('topology-select').addEventListener('change', function (e) {
    const id = e.target.value;
    if (id) {
      loadTopology(id);
    }
  });

  // Create Topology
  document.getElementById('btn-create-topology').addEventListener('click', function () {
    const nameInput = document.getElementById('new-topology-name');
    const name = nameInput.value.trim();
    if (!name) {
      alert('Masukkan nama topologi terlebih dahulu!');
      return;
    }

    fetch('/api/topologies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
    .then(res => {
      if (!res.ok) throw new Error('Gagal membuat topologi');
      return res.json();
    })
    .then(newTopo => {
      nameInput.value = '';
      alert(`Topologi "${newTopo.name}" berhasil dibuat!`);
      loadTopologies(newTopo.id);
    })
    .catch(err => {
      console.error(err);
      alert('Gagal membuat topologi baru.');
    });
  });

  // Delete Topology
  document.getElementById('btn-delete-topology').addEventListener('click', function () {
    if (!activeTopologyId) return;
    if (activeTopologyId === 'topology-1') {
      alert('Topologi bawaan (topology-1) tidak boleh dihapus agar sistem memiliki template awal!');
      return;
    }
    if (!confirm('Apakah Anda yakin ingin menghapus seluruh topologi aktif ini? Tindakan ini tidak bisa dibatalkan.')) {
      return;
    }

    fetch(`/api/topologies/${activeTopologyId}`, {
      method: 'DELETE'
    })
    .then(res => {
      if (!res.ok) throw new Error('Gagal menghapus topologi');
      return res.json();
    })
    .then(() => {
      alert('Topologi berhasil dihapus.');
      loadTopologies();
    })
    .catch(err => {
      console.error(err);
      alert('Gagal menghapus topologi.');
    });
  });

  // Add Node
  document.getElementById('btn-add-node').addEventListener('click', function () {
    if (!activeTopologyId) {
      alert('Silakan pilih atau buat topologi terlebih dahulu!');
      return;
    }
    const type = document.getElementById('node-type').value;
    const nodeIdInput = document.getElementById('node-id');
    const nodeLabelInput = document.getElementById('node-label');

    const nodeId = nodeIdInput.value.trim().toLowerCase().replace(/\s+/g, '-');
    const label = nodeLabelInput.value.trim();

    if (!nodeId) {
      alert('Masukkan Node ID unik (tidak boleh kosong)!');
      return;
    }

    // Direct check for duplicate local node IDs before sending
    if (activeTopologyData && activeTopologyData.nodes.some(n => n.id === nodeId)) {
      alert('Node ID sudah digunakan di dalam topologi ini! Gunakan ID unik lain.');
      return;
    }

    fetch(`/api/topologies/${activeTopologyId}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId, type, label })
    })
    .then(res => {
      if (!res.ok) return res.json().then(e => { throw new Error(e.error || 'Gagal') });
      return res.json();
    })
    .then(() => {
      nodeIdInput.value = '';
      nodeLabelInput.value = '';
      loadTopology(activeTopologyId);
    })
    .catch(err => {
      console.error(err);
      alert(err.message || 'Gagal menambahkan node baru.');
    });
  });

  // Delete Selected Node
  document.getElementById('btn-delete-node').addEventListener('click', function () {
    if (!activeTopologyId || !selectedNodeId) return;
    if (!confirm(`Hapus node "${selectedNodeId}" beserta seluruh sambungan edge-nya?`)) return;

    fetch(`/api/topologies/${activeTopologyId}/nodes/${selectedNodeId}`, {
      method: 'DELETE'
    })
    .then(res => {
      if (!res.ok) throw new Error('Gagal menghapus node');
      return res.json();
    })
    .then(() => {
      resetSelection();
      loadTopology(activeTopologyId);
    })
    .catch(err => {
      console.error(err);
      alert('Gagal menghapus node.');
    });
  });

  // Add Edge
  document.getElementById('btn-add-edge').addEventListener('click', function () {
    if (!activeTopologyId) return;
    const source = document.getElementById('edge-source').value;
    const target = document.getElementById('edge-target').value;

    if (!source || !target) {
      alert('Silakan pilih Source dan Target node!');
      return;
    }

    if (source === target) {
      alert('Source dan Target node tidak boleh sama!');
      return;
    }

    // Rule validation: Edges MUST connect to/from a Subnet
    if (activeTopologyData) {
      const sourceNode = activeTopologyData.nodes.find(n => n.id === source);
      const targetNode = activeTopologyData.nodes.find(n => n.id === target);
      
      if (sourceNode && targetNode) {
        if (sourceNode.type !== 'subnet' && targetNode.type !== 'subnet') {
          alert('ATURAN TOPOLOGI: Router dan VM Instance HANYA diperbolehkan terhubung langsung ke Subnet (salah satu node harus bertipe Subnet)!');
          return;
        }
      }
    }

    fetch(`/api/topologies/${activeTopologyId}/edges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, target })
    })
    .then(res => {
      if (!res.ok) return res.json().then(e => { throw new Error(e.error || 'Gagal') });
      return res.json();
    })
    .then(() => {
      loadTopology(activeTopologyId);
    })
    .catch(err => {
      console.error(err);
      alert(err.message || 'Gagal menghubungkan node.');
    });
  });

  // Delete Selected Edge
  document.getElementById('btn-delete-edge').addEventListener('click', function () {
    if (!activeTopologyId || !selectedEdgeId) return;
    if (!confirm(`Hapus koneksi edge "${selectedEdgeId}"?`)) return;

    fetch(`/api/topologies/${activeTopologyId}/edges/${selectedEdgeId}`, {
      method: 'DELETE'
    })
    .then(res => {
      if (!res.ok) throw new Error('Gagal menghapus edge');
      return res.json();
    })
    .then(() => {
      resetSelection();
      loadTopology(activeTopologyId);
    })
    .catch(err => {
      console.error(err);
      alert('Gagal menghapus edge.');
    });
  });
}

// Fetch all topologies from the Hono server
function loadTopologies(selectId = '') {
  fetch('/api/topologies')
    .then(res => res.json())
    .then(data => {
      topologies = data;
      const select = document.getElementById('topology-select');
      select.innerHTML = '';

      if (topologies.length === 0) {
        select.innerHTML = '<option value="">(Tidak ada topologi)</option>';
        activeTopologyId = '';
        activeTopologyData = null;
        if (cyInstance) cyInstance.destroy();
        return;
      }

      topologies.forEach(topo => {
        const option = document.createElement('option');
        option.value = topo.id;
        option.textContent = topo.name;
        select.appendChild(option);
      });

      // Select newly created, previously selected, or default topology
      let targetId = selectId || activeTopologyId || topologies[0].id;
      if (!topologies.some(t => t.id === targetId)) {
        targetId = topologies[0].id;
      }

      select.value = targetId;
      loadTopology(targetId);
    })
    .catch(err => {
      console.error('Error loading topologies list:', err);
      alert('Gagal mengambil daftar topologi dari server.');
    });
}

// Fetch detail of a single topology
function loadTopology(id) {
  activeTopologyId = id;
  resetSelection();

  fetch(`/api/topologies/${id}`)
    .then(res => {
      if (!res.ok) throw new Error('Topologi tidak ditemukan');
      return res.json();
    })
    .then(data => {
      activeTopologyData = data;
      
      // Update form dropdowns with available nodes
      populateNodeDropdowns(data.nodes);

      // Render with auto-layout
      renderTopology(data);
    })
    .catch(err => {
      console.error('Error loading topology detail:', err);
      alert('Gagal memuat detail topologi.');
    });
}

// Helper to fill the edge creation source/target selects
function populateNodeDropdowns(nodes) {
  const sourceSelect = document.getElementById('edge-source');
  const targetSelect = document.getElementById('edge-target');

  sourceSelect.innerHTML = '<option value="">-- Pilih Source --</option>';
  targetSelect.innerHTML = '<option value="">-- Pilih Target --</option>';

  // Sort nodes by label for easier dropdown searching
  const sortedNodes = [...nodes].sort((a, b) => {
    const labelA = a.data.label || a.id;
    const labelB = b.data.label || b.id;
    return labelA.localeCompare(labelB);
  });

  sortedNodes.forEach(node => {
    const label = `${node.data.label || node.id} (${node.type.toUpperCase()})`;
    
    const optSource = document.createElement('option');
    optSource.value = node.id;
    optSource.textContent = label;
    sourceSelect.appendChild(optSource);

    const optTarget = document.createElement('option');
    optTarget.value = node.id;
    optTarget.textContent = label;
    targetSelect.appendChild(optTarget);
  });
}

// Reset node and edge selection UI states
function resetSelection() {
  selectedNodeId = null;
  selectedEdgeId = null;

  const nodeInfo = document.getElementById('selected-node-info');
  nodeInfo.textContent = 'Info: Klik node di grafik untuk memilih.';
  nodeInfo.className = 'selected-indicator';
  document.getElementById('btn-delete-node').disabled = true;

  const edgeInfo = document.getElementById('selected-edge-info');
  edgeInfo.textContent = 'Info: Klik garis edge untuk memilih.';
  edgeInfo.className = 'selected-indicator';
  document.getElementById('btn-delete-edge').disabled = true;
}

// dynamic horizontal auto-layout solver
function renderTopology(topologyData) {
  const nodes = topologyData.nodes;
  const edges = topologyData.edges;

  // 1. Separate nodes by type
  const subnets = nodes.filter(n => n.type === 'subnet');
  const routers = nodes.filter(n => n.type === 'router');
  const instances = nodes.filter(n => n.type === 'instance' || n.type === 'vm');

  // Sort subnets alphabetically for consistent left-to-right alignment
  subnets.sort((a, b) => a.id.localeCompare(b.id));

  // 2. Dynamic subnet coloring
  const subnetColors = {};
  subnets.forEach((subnet, index) => {
    const color = SUBNET_PALETTE[index % SUBNET_PALETTE.length];
    subnetColors[subnet.id] = color;
    subnet.color = color;
  });

  // 3. Adjacency mappings
  const subnetLeftNodes = {};
  const subnetRightNodes = {};
  subnets.forEach(s => {
    subnetLeftNodes[s.id] = [];
    subnetRightNodes[s.id] = [];
  });

  const routerConnectedSubnets = {};
  routers.forEach(r => {
    routerConnectedSubnets[r.id] = [];
  });

  const instanceConnectedSubnets = {};
  instances.forEach(vm => {
    instanceConnectedSubnets[vm.id] = [];
  });

  // Map edges
  edges.forEach(edge => {
    const s = edge.source;
    const t = edge.target;

    const sourceNode = nodes.find(n => n.id === s);
    const targetNode = nodes.find(n => n.id === t);

    if (!sourceNode || !targetNode) return;

    if (sourceNode.type === 'router' && targetNode.type === 'subnet') {
      routerConnectedSubnets[s].push(t);
    } else if (sourceNode.type === 'subnet' && targetNode.type === 'router') {
      routerConnectedSubnets[t].push(s);
    } else if (sourceNode.type === 'instance' && targetNode.type === 'subnet') {
      instanceConnectedSubnets[s].push(t);
    } else if (sourceNode.type === 'subnet' && targetNode.type === 'instance') {
      instanceConnectedSubnets[t].push(s);
    }
  });

  // Sort routers into single-subnet (left) and multi-subnet (middle)
  const multiSubnetRouters = [];
  routers.forEach(r => {
    const connected = routerConnectedSubnets[r.id];
    if (connected.length === 1) {
      const subnetId = connected[0];
      if (subnetLeftNodes[subnetId]) {
        subnetLeftNodes[subnetId].push(r.id);
      }
    } else if (connected.length > 1) {
      multiSubnetRouters.push(r.id);
    }
  });

  // VM Instances go to the right of their subnet
  instances.forEach(vm => {
    const connected = instanceConnectedSubnets[vm.id];
    if (connected.length >= 1) {
      const subnetId = connected[0];
      if (subnetRightNodes[subnetId]) {
        subnetRightNodes[subnetId].push(vm.id);
      }
    }
  });

  // 4. Calculate Coordinates (x, y)
  const pos = {};
  const SUBNET_HEIGHT = 200;
  const SUBNET_Y = 300;

  // Space subnets horizontally
  subnets.forEach((s, idx) => {
    const x = 320 + idx * 350;
    pos[s.id] = { x: x, y: SUBNET_Y };
  });

  // Store Y offsets relative to subnets for dynamic endpoints
  const subnetEndpoints = {};
  subnets.forEach(s => {
    subnetEndpoints[s.id] = {};
  });

  // Single-Subnet Routers on Left
  subnets.forEach(s => {
    const leftNodes = subnetLeftNodes[s.id];
    const n = leftNodes.length;
    const subnetX = pos[s.id].x;

    leftNodes.forEach((nodeId, idx) => {
      const x = subnetX - 200; // Positioned left of subnet
      let y = SUBNET_Y;

      if (n > 1) {
        y = SUBNET_Y - SUBNET_HEIGHT / 2 + (SUBNET_HEIGHT / (n + 1)) * (idx + 1);
      }

      pos[nodeId] = { x: x, y: y };
      subnetEndpoints[s.id][nodeId] = { side: 'left', offset: y - SUBNET_Y };
    });
  });

  // Instances on Right
  subnets.forEach((s, idx) => {
    const rightNodes = subnetRightNodes[s.id];
    const n = rightNodes.length;
    const subnetX = pos[s.id].x;
    const isLastSubnet = (idx === subnets.length - 1);

    rightNodes.forEach((nodeId, idx2) => {
      // If it's the last subnet, place further right. Otherwise, place in intermediate gap.
      const x = isLastSubnet ? (subnetX + 200) : (subnetX + 150);
      let y = SUBNET_Y;

      if (n > 1) {
        y = SUBNET_Y - SUBNET_HEIGHT / 2 + (SUBNET_HEIGHT / (n + 1)) * (idx2 + 1);
      }

      pos[nodeId] = { x: x, y: y };
      subnetEndpoints[s.id][nodeId] = { side: 'right', offset: y - SUBNET_Y };
    });
  });

  // Multi-Subnet Routers in between
  const multiSubnetRouterSlots = [360, 240, 300, 200, 400];
  multiSubnetRouters.forEach((routerId, idx) => {
    const connectedSubnets = routerConnectedSubnets[routerId];
    let sumX = 0;
    connectedSubnets.forEach(subnetId => {
      if (pos[subnetId]) sumX += pos[subnetId].x;
    });
    const x = connectedSubnets.length > 0 ? (sumX / connectedSubnets.length) : 450;
    const y = multiSubnetRouterSlots[idx % multiSubnetRouterSlots.length];
    
    pos[routerId] = { x: x, y: y };

    connectedSubnets.forEach(subnetId => {
      const subnetX = pos[subnetId].x;
      const side = (x < subnetX) ? 'left' : 'right';
      subnetEndpoints[subnetId][routerId] = { side: side, offset: y - SUBNET_Y };
    });
  });

  // 5. Build Cytoscape Elements & Custom Edge Styling
  const cyElements = [];

  // Add Subnets
  subnets.forEach(s => {
    cyElements.push({
      data: {
        id: s.id,
        label: s.data.label || s.id,
        type: 'subnet',
        color: subnetColors[s.id],
        shape: 'round-rectangle',
        width: 20,
        height: SUBNET_HEIGHT
      },
      position: pos[s.id]
    });
  });

  // Add Routers
  routers.forEach(r => {
    cyElements.push({
      data: {
        id: r.id,
        label: r.data.label || r.id,
        type: 'router',
        color: ROUTER_COLOR,
        shape: 'diamond',
        width: 60,
        height: 60
      },
      position: pos[r.id]
    });
  });

  // Add Instances
  instances.forEach(vm => {
    cyElements.push({
      data: {
        id: vm.id,
        label: vm.data.label || vm.id,
        type: 'instance',
        color: INSTANCE_COLOR,
        shape: 'round-rectangle',
        width: 90,
        height: 36
      },
      position: pos[vm.id]
    });
  });

  const edgeStyles = [];

  // Add Edges
  edges.forEach(edge => {
    const s = edge.source;
    const t = edge.target;
    const edgeId = edge.id || `e-${s}-${t}`;

    cyElements.push({ data: { id: edgeId, source: s, target: t } });

    const sourceNode = nodes.find(n => n.id === s);
    const targetNode = nodes.find(n => n.id === t);

    if (!sourceNode || !targetNode) return;

    let subnetNode, peerNode, subnetIsSource;
    if (sourceNode.type === 'subnet') {
      subnetNode = sourceNode;
      peerNode = targetNode;
      subnetIsSource = true;
    } else if (targetNode.type === 'subnet') {
      subnetNode = targetNode;
      peerNode = sourceNode;
      subnetIsSource = false;
    } else {
      return;
    }

    const subnetId = subnetNode.id;
    const peerId = peerNode.id;
    const subnetColor = subnetColors[subnetId];

    const endpointInfo = subnetEndpoints[subnetId][peerId];
    if (!endpointInfo) return;

    const subnetYOffset = endpointInfo.offset;
    const side = endpointInfo.side;

    const subnetXOffsetVal = (side === 'left') ? -10 : 10;
    const subnetEndpointStr = `${subnetXOffsetVal}px ${subnetYOffset}px`;

    let peerEndpointStr = '0px 0px';
    if (peerNode.type === 'router') {
      peerEndpointStr = (side === 'left') ? '30px 0px' : '-30px 0px';
    } else {
      peerEndpointStr = (side === 'left') ? '45px 0px' : '-45px 0px';
    }

    const sourceEndpoint = subnetIsSource ? subnetEndpointStr : peerEndpointStr;
    const targetEndpoint = subnetIsSource ? peerEndpointStr : subnetEndpointStr;

    edgeStyles.push({
      selector: `#${edgeId}`,
      style: {
        'width': 2.5,
        'line-color': subnetColor,
        'curve-style': 'straight',
        'source-endpoint': sourceEndpoint,
        'target-endpoint': targetEndpoint
      }
    });
  });

  // Destroy previous graph if exists
  if (cyInstance) {
    cyInstance.destroy();
  }

  // Initialize Cytoscape.js
  cyInstance = cytoscape({
    container: document.getElementById('cy'),
    layout: { name: 'preset' },
    style: [
      {
        selector: 'node',
        style: {
          'label': 'data(label)',
          'background-color': 'data(color)',
          'shape': 'data(shape)',
          'width': 'data(width)',
          'height': 'data(height)',
          'text-valign': 'bottom',
          'text-halign': 'center',
          'font-size': 10,
          'font-weight': 'bold',
          'color': '#cfd8dc',
          'text-margin-y': 8,
          'text-wrap': 'wrap',
          'text-max-width': 120,
          'border-width': 2.5,
          'border-color': 'rgba(255,255,255,0.1)',
          'border-style': 'solid',
          'transition-property': 'background-color border-color text-color',
          'transition-duration': '0.2s'
        },
      },
      {
        selector: 'node:selected',
        style: {
          'border-color': '#fff',
          'border-width': 3,
          'color': '#ffffff'
        }
      },
      {
        selector: 'edge:selected',
        style: {
          'width': 4.5,
          'line-color': '#fff'
        }
      }
    ].concat(edgeStyles),
    elements: cyElements
  });

  // Click-to-Select Handlers
  cyInstance.on('tap', 'node', function (evt) {
    const node = evt.target;
    selectedNodeId = node.id();
    selectedEdgeId = null;

    // Highlight node details in UI
    const nodeInfo = document.getElementById('selected-node-info');
    nodeInfo.textContent = `Terpilih: Node "${node.id()}" (${node.data('type').toUpperCase()})`;
    nodeInfo.className = 'selected-indicator active';
    document.getElementById('btn-delete-node').disabled = false;

    // Reset Edge selection indicator
    const edgeInfo = document.getElementById('selected-edge-info');
    edgeInfo.textContent = 'Info: Klik garis edge untuk memilih.';
    edgeInfo.className = 'selected-indicator';
    document.getElementById('btn-delete-edge').disabled = true;
  });

  cyInstance.on('tap', 'edge', function (evt) {
    const edge = evt.target;
    selectedEdgeId = edge.id();
    selectedNodeId = null;

    // Highlight edge details in UI
    const edgeInfo = document.getElementById('selected-edge-info');
    edgeInfo.textContent = `Terpilih: Edge "${edge.id()}"`;
    edgeInfo.className = 'selected-indicator active-danger';
    document.getElementById('btn-delete-edge').disabled = false;

    // Reset Node selection indicator
    const nodeInfo = document.getElementById('selected-node-info');
    nodeInfo.textContent = 'Info: Klik node di grafik untuk memilih.';
    nodeInfo.className = 'selected-indicator';
    document.getElementById('btn-delete-node').disabled = true;
  });

  // Tap on blank canvas clears selection
  cyInstance.on('tap', function (evt) {
    if (evt.target === cyInstance) {
      resetSelection();
    }
  });
}
