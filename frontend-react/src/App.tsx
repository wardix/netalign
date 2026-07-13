import React, { useState, useEffect } from 'react';

import { Layout, Menu, Select, Button, Input, Form, message, Modal, Divider, Space } from 'antd';
import TopologyGraph from './components/TopologyGraph';
import { API_BASE } from './api';

const { Header, Sider, Content } = Layout;

interface TopologyInfo {
  id: string;
  name: string;
}

const App: React.FC = () => {
  const [topologies, setTopologies] = useState<TopologyInfo[]>([]);
  const [activeTopologyId, setActiveTopologyId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedNodeData, setSelectedNodeData] = useState<any>(null);
  const [selectedEdgeData, setSelectedEdgeData] = useState<any>(null);
  const [nodeModalVisible, setNodeModalVisible] = useState(false);
  const [edgeModalVisible, setEdgeModalVisible] = useState(false);



  // Load topologies list
  const loadTopologies = (selectId?: string) => {
    fetch(`${API_BASE}/api/topologies`)
      .then(res => res.json())
      .then((data: TopologyInfo[]) => {
        setTopologies(data);
        const targetId = selectId || data[0]?.id || null;
        setActiveTopologyId(targetId);
      })
      .catch(err => {
        console.error(err);
        message.error('Failed to load topologies');
      });
  };

  useEffect(() => {
    loadTopologies();
  }, []);

  // Selection handlers with detail fetch
  const handleNodeSelect = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    setSelectedEdgeData(null);
    // fetch node details
    if (activeTopologyId) {
      fetch(`${API_BASE}/api/topologies/${activeTopologyId}/nodes/${nodeId}`)
        .then(res => res.json())
        .then(data => {
          setSelectedNodeData(data);
          setNodeModalVisible(true);
        })
        .catch(err => console.error('Failed node detail', err));
    }
  };
  const handleEdgeSelect = (edgeId: string) => {
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);
    setSelectedNodeData(null);
    if (activeTopologyId) {
      fetch(`${API_BASE}/api/topologies/${activeTopologyId}/edges/${edgeId}`)
        .then(res => res.json())
        .then(data => {
          setSelectedEdgeData(data);
          setEdgeModalVisible(true);
        })
        .catch(err => console.error('Failed edge detail', err));
    }
  };

  // --- Topology actions ---
  const createTopology = (name: string) => {
    fetch(`${API_BASE}/api/topologies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
      .then(res => {
        if (!res.ok) throw new Error('Create failed');
        return res.json();
      })
      .then(newTopo => {
        message.success(`Topology "${newTopo.name}" created`);
        loadTopologies(newTopo.id);
      })
      .catch(err => {
        console.error(err);
        message.error('Failed to create topology');
      });
  };

  const deleteTopology = () => {
    if (!activeTopologyId) return;
    if (activeTopologyId === 'topology-1') {
      Modal.info({ title: 'Protected', content: 'Default topology cannot be deleted.' });
      return;
    }
    Modal.confirm({
      title: 'Delete topology?',
      content: 'This action cannot be undone.',
      onOk: () => {
        fetch(`${API_BASE}/api/topologies/${activeTopologyId}`, { method: 'DELETE' })
          .then(res => {
            if (!res.ok) throw new Error('Delete failed');
            return res.json();
          })
          .then(() => {
            message.success('Topology deleted');
            loadTopologies();
          })
          .catch(err => {
            console.error(err);
            message.error('Failed to delete topology');
          });
      },
    });
  };

  // --- Node actions ---
  const addNode = (values: any) => {
    if (!activeTopologyId) return message.warning('Select a topology first');
    const nodeId = values.nodeId.trim().toLowerCase().replace(/\s+/g, '-');
    const payload = { nodeId, type: values.nodeType, label: values.nodeLabel };
    fetch(`${API_BASE}/api/topologies/${activeTopologyId}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(res => {
        if (!res.ok) return res.json().then(e => { throw new Error(e.error || 'Add node failed'); });
        return res.json();
      })
      .then(() => {
        message.success('Node added');
        setRefreshKey(k => k + 1);
      })
      .catch(err => {
        console.error(err);
        message.error(err.message || 'Failed to add node');
      });
  };

  const deleteNode = (nodeId: string) => {
    if (!activeTopologyId) return;
    Modal.confirm({
      title: `Delete node "${nodeId}"?`,
      content: 'All connected edges will be removed.',
      onOk: () => {
        fetch(`${API_BASE}/api/topologies/${activeTopologyId}/nodes/${nodeId}`, { method: 'DELETE' })
          .then(res => {
            if (!res.ok) throw new Error('Delete node failed');
            return res.json();
          })
          .then(() => {
            message.success('Node deleted');
            setRefreshKey(k => k + 1);
          })
          .catch(err => {
            console.error(err);
            message.error('Failed to delete node');
          });
      },
    });
  };

  // --- Edge actions ---
  const addEdge = (values: any) => {
    if (!activeTopologyId) return message.warning('Select a topology first');
    const payload = { source: values.source, target: values.target };
    fetch(`${API_BASE}/api/topologies/${activeTopologyId}/edges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(res => {
        if (!res.ok) return res.json().then(e => { throw new Error(e.error || 'Add edge failed'); });
        return res.json();
      })
      .then(() => {
        message.success('Edge added');
        setRefreshKey(k => k + 1);
      })
      .catch(err => {
        console.error(err);
        message.error(err.message || 'Failed to add edge');
      });
  };

  const deleteEdge = (edgeId: string) => {
    if (!activeTopologyId) return;
    Modal.confirm({
      title: `Delete edge "${edgeId}"?`,
      onOk: () => {
        fetch(`${API_BASE}/api/topologies/${activeTopologyId}/edges/${edgeId}`, { method: 'DELETE' })
          .then(res => {
            if (!res.ok) throw new Error('Delete edge failed');
            return res.json();
          })
          .then(() => {
            message.success('Edge deleted');
            setRefreshKey(k => k + 1);
          })
          .catch(err => {
            console.error(err);
            message.error('Failed to delete edge');
          });
      },
    });
  };

  // Forms for creating new topology / node / edge
  const [topoForm] = Form.useForm();
  const [nodeForm] = Form.useForm();
  const [edgeForm] = Form.useForm();

  return (
    <Layout style={{ height: '100vh', background: '#0e1117' }}>
      <Header style={{
        background: 'rgba(20, 24, 33, 0.85)',
        color: '#f3f4f6',
        fontSize: 20,
        fontWeight: '600',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center'
      }}>
        NetAlign – Ant Design UI
      </Header>
      <Layout style={{ background: '#0e1117' }}>
        <Sider
          width={300}
          theme="dark"
          style={{
            background: 'rgba(20, 24, 33, 0.85)',
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
            padding: 16,
            overflow: 'auto',
            backdropFilter: 'blur(8px)'
          }}
        >
          <Divider orientation="left" style={{ borderColor: 'rgba(255, 255, 255, 0.15)', color: '#9ca3af' }}>Topologies</Divider>
          <Select
            style={{ width: '100%' }}
            placeholder="Select topology"
            value={activeTopologyId || undefined}
            onChange={id => setActiveTopologyId(id)}
          >
            {topologies.map(t => (
              <Select.Option key={t.id} value={t.id}>
                {t.name}
              </Select.Option>
            ))}
          </Select>
          <Space style={{ marginTop: 8, width: '100%' }}>
            <Button type="primary" onClick={() => {
              Modal.confirm({
                title: 'Create Topology',
                content: (
                  <Form form={topoForm} layout="vertical">
                    <Form.Item name="name" label="Name" rules={[{ required: true }]}> 
                      <Input />
                    </Form.Item>
                  </Form>
                ),
                onOk: async () => {
                  const values = await topoForm.validateFields();
                  createTopology(values.name);
                  topoForm.resetFields();
                },
                okText: 'Create',
                cancelText: 'Cancel',
              });
            }}>New</Button>
            <Button danger onClick={deleteTopology}>Delete</Button>
          </Space>

          <Divider orientation="left" style={{ borderColor: 'rgba(255, 255, 255, 0.15)', color: '#9ca3af' }}>Add Node</Divider>
          <Form form={nodeForm} layout="vertical" onFinish={addNode} style={{ marginBottom: 12 }}>
            <Form.Item name="nodeId" label="Node ID" rules={[{ required: true }]}> <Input /> </Form.Item>
            <Form.Item name="nodeLabel" label="Label" rules={[{ required: true }]}> <Input /> </Form.Item>
            <Form.Item name="nodeType" label="Type" rules={[{ required: true }]} initialValue="subnet">
              <Select>
                <Select.Option value="subnet">Subnet</Select.Option>
                <Select.Option value="router">Router</Select.Option>
                <Select.Option value="instance">Instance</Select.Option>
              </Select>
            </Form.Item>
            <Button type="primary" htmlType="submit" block>Add Node</Button>
          </Form>

          <Divider orientation="left" style={{ borderColor: 'rgba(255, 255, 255, 0.15)', color: '#9ca3af' }}>Add Edge</Divider>
          <Form form={edgeForm} layout="vertical" onFinish={addEdge} style={{ marginBottom: 12 }}>
            <Form.Item name="source" label="Source" rules={[{ required: true }]}> <Input /> </Form.Item>
            <Form.Item name="target" label="Target" rules={[{ required: true }]}> <Input /> </Form.Item>
            <Button type="primary" htmlType="submit" block>Add Edge</Button>
          </Form>

          {/* Selected item actions */}
          {selectedNodeId && (
            <>
              <Divider orientation="left" style={{ borderColor: 'rgba(255, 255, 255, 0.15)', color: '#9ca3af' }}>Selected Node</Divider>
              <Space>
                <span style={{ color: '#fff' }}>{selectedNodeId}</span>
                <Button danger onClick={() => deleteNode(selectedNodeId)}>Delete Node</Button>
              </Space>
            </>
          )}
          {selectedEdgeId && (
            <>
              <Divider orientation="left" style={{ borderColor: 'rgba(255, 255, 255, 0.15)', color: '#9ca3af' }}>Selected Edge</Divider>
              <Space>
                <span style={{ color: '#fff' }}>{selectedEdgeId}</span>
                <Button danger onClick={() => deleteEdge(selectedEdgeId)}>Delete Edge</Button>
              </Space>
            </>
          )}
        </Sider>
        <Content style={{
          padding: 0,
          background: '#0e1117',
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.08) 1.5px, transparent 0)',
          backgroundSize: '24px 24px'
        }}>
          <TopologyGraph
            activeTopologyId={activeTopologyId}
            triggerRefresh={refreshKey}
            onNodeSelect={handleNodeSelect}
            onEdgeSelect={handleEdgeSelect}
          />
        <Modal
  title="Node Details"
  visible={nodeModalVisible}
  onCancel={() => setNodeModalVisible(false)}
  footer={null}
>
  {selectedNodeData ? (
    <Form layout="vertical" initialValues={selectedNodeData} onFinish={(values) => {
      // simple update via PUT
      fetch(`${API_BASE}/api/topologies/${activeTopologyId}/nodes/${selectedNodeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
        .then(res => {
          if (!res.ok) throw new Error('Update failed');
          return res.json();
        })
        .then(() => {
          message.success('Node updated');
          setNodeModalVisible(false);
          setRefreshKey(k => k + 1);
        })
        .catch(err => {
          console.error(err);
          message.error('Failed to update node');
        });
    }}>
      <Form.Item name="id" label="ID" rules={[{ required: true }]}>
        <Input disabled />
      </Form.Item>
      <Form.Item name="label" label="Label" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item name="type" label="Type" rules={[{ required: true }]}>
        <Input disabled />
      </Form.Item>
      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit">Save</Button>
          <Button onClick={() => setNodeModalVisible(false)}>Cancel</Button>
        </Space>
      </Form.Item>
    </Form>
  ) : <p>Loading...</p>}
</Modal>

<Modal
  title="Edge Details"
  visible={edgeModalVisible}
  onCancel={() => setEdgeModalVisible(false)}
  footer={null}
>
  {selectedEdgeData ? (
    <Form layout="vertical" initialValues={selectedEdgeData} onFinish={(values) => {
      fetch(`${API_BASE}/api/topologies/${activeTopologyId}/edges/${selectedEdgeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
        .then(res => {
          if (!res.ok) throw new Error('Update failed');
          return res.json();
        })
        .then(() => {
          message.success('Edge updated');
          setEdgeModalVisible(false);
          setRefreshKey(k => k + 1);
        })
        .catch(err => {
          console.error(err);
          message.error('Failed to update edge');
        });
    }}>
      <Form.Item name="id" label="ID" rules={[{ required: true }]}>
        <Input disabled />
      </Form.Item>
      <Form.Item name="source" label="Source" rules={[{ required: true }]}>
        <Input disabled />
      </Form.Item>
      <Form.Item name="target" label="Target" rules={[{ required: true }]}>
        <Input disabled />
      </Form.Item>
      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit">Save</Button>
          <Button onClick={() => setEdgeModalVisible(false)}>Cancel</Button>
        </Space>
      </Form.Item>
    </Form>
  ) : <p>Loading...</p>}
</Modal>
</Content>
      </Layout>
      </Layout>
  );
};

export default App;
