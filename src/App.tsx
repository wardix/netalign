import React, { useState, useEffect, useMemo } from 'react';

import { Layout, Select, Button, Input, Form, message, Modal, Divider, Space, Descriptions } from 'antd';
import TopologyGraph from './components/TopologyGraph';
import { API_BASE } from './api';
import { validateEdgeBetweenNodes } from '../shared/edgeValidation.ts';
import {
  formatNodeOptionLabel,
  getValidTargetNodes,
  sortNodesByLabel,
  type TopologyNode,
} from '../shared/topologyNodes.ts';

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
  const [activeNodes, setActiveNodes] = useState<TopologyNode[]>([]);
  const [topoForm] = Form.useForm();
  const [nodeForm] = Form.useForm();
  const [edgeForm] = Form.useForm();

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

  const loadTopologyDetail = (topologyId: string) =>
    fetch(`${API_BASE}/api/topologies/${topologyId}`).then(res => {
      if (!res.ok) throw new Error('Failed to load topology');
      return res.json();
    });

  useEffect(() => {
    loadTopologies();
  }, []);

  useEffect(() => {
    if (!activeTopologyId) {
      setActiveNodes([]);
      return;
    }
    loadTopologyDetail(activeTopologyId)
      .then(data => setActiveNodes(data.nodes ?? []))
      .catch(err => {
        console.error('Failed to load topology nodes', err);
        setActiveNodes([]);
      });
  }, [activeTopologyId, refreshKey]);

  useEffect(() => {
    edgeForm.resetFields();
  }, [activeTopologyId, edgeForm]);

  const edgeSource = Form.useWatch('source', edgeForm);

  const sourceOptions = useMemo(
    () =>
      sortNodesByLabel(activeNodes).map(node => ({
        value: node.id,
        label: formatNodeOptionLabel(node),
      })),
    [activeNodes],
  );

  const targetOptions = useMemo(
    () =>
      getValidTargetNodes(edgeSource, activeNodes).map(node => ({
        value: node.id,
        label: formatNodeOptionLabel(node),
      })),
    [edgeSource, activeNodes],
  );

  const handleNodeSelect = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    setSelectedEdgeData(null);
    if (!activeTopologyId) return;
    loadTopologyDetail(activeTopologyId)
      .then(data => {
        const node = data.nodes.find((n: { id: string }) => n.id === nodeId);
        if (!node) return;
        setSelectedNodeData({
          id: node.id,
          label: node.data?.label || node.id,
          type: node.type,
        });
        setNodeModalVisible(true);
      })
      .catch(err => {
        console.error('Failed node detail', err);
        message.error('Failed to load node details');
      });
  };

  const handleEdgeSelect = (edgeId: string) => {
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);
    setSelectedNodeData(null);
    if (!activeTopologyId) return;
    loadTopologyDetail(activeTopologyId)
      .then(data => {
        const edge = data.edges.find((e: { id: string }) => e.id === edgeId);
        if (!edge) return;
        setSelectedEdgeData(edge);
        setEdgeModalVisible(true);
      })
      .catch(err => {
        console.error('Failed edge detail', err);
        message.error('Failed to load edge details');
      });
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
        nodeForm.resetFields();
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
            setSelectedNodeId(null);
            setSelectedNodeData(null);
            setNodeModalVisible(false);
            setRefreshKey(k => k + 1);
          })
          .catch(err => {
            console.error(err);
            message.error('Failed to delete node');
          });
      },
    });
  };

  const validateEdgeForm = (source: string, target: string): string | null => {
    const trimmedSource = source.trim();
    const trimmedTarget = target.trim();

    if (!trimmedSource || !trimmedTarget) {
      return 'Source and target are required';
    }
    if (trimmedSource === trimmedTarget) {
      return 'Source and target must be different nodes';
    }

    const sourceNode = activeNodes.find(n => n.id === trimmedSource);
    const targetNode = activeNodes.find(n => n.id === trimmedTarget);

    if (!sourceNode || !targetNode) {
      return 'Source or target node does not exist in the active topology';
    }

    return validateEdgeBetweenNodes(sourceNode, targetNode);
  };

  // --- Edge actions ---
  const addEdge = (values: { source: string; target: string }) => {
    if (!activeTopologyId) return message.warning('Select a topology first');

    const validationError = validateEdgeForm(values.source, values.target);
    if (validationError) {
      message.error(validationError);
      return;
    }

    const payload = {
      source: values.source.trim(),
      target: values.target.trim(),
    };
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
        edgeForm.resetFields();
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
            setSelectedEdgeId(null);
            setSelectedEdgeData(null);
            setEdgeModalVisible(false);
            setRefreshKey(k => k + 1);
          })
          .catch(err => {
            console.error(err);
            message.error('Failed to delete edge');
          });
      },
    });
  };

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
        NetAlign
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
          <Divider titlePlacement="left" style={{ borderColor: 'rgba(255, 255, 255, 0.15)', color: '#9ca3af' }}>Topologies</Divider>
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

          <Divider titlePlacement="left" style={{ borderColor: 'rgba(255, 255, 255, 0.15)', color: '#9ca3af' }}>Add Node</Divider>
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

          <Divider titlePlacement="left" style={{ borderColor: 'rgba(255, 255, 255, 0.15)', color: '#9ca3af' }}>Add Edge</Divider>
          <Form form={edgeForm} layout="vertical" onFinish={addEdge} style={{ marginBottom: 12 }}>
            <Form.Item name="source" label="Source" rules={[{ required: true, message: 'Select a source node' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={activeNodes.length ? 'Select source node' : 'No nodes in topology'}
                disabled={activeNodes.length === 0}
                options={sourceOptions}
                onChange={() => edgeForm.setFieldValue('target', undefined)}
              />
            </Form.Item>
            <Form.Item
              name="target"
              label="Target"
              dependencies={['source']}
              rules={[
                { required: true, message: 'Select a target node' },
                {
                  validator: async (_, value) => {
                    const source = edgeForm.getFieldValue('source');
                    if (!source || !value) return;
                    const error = validateEdgeForm(source, value);
                    if (error) throw new Error(error);
                  },
                },
              ]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={
                  !edgeSource
                    ? 'Select source first'
                    : targetOptions.length
                      ? 'Select target node'
                      : 'No valid targets for this source'
                }
                disabled={!edgeSource || targetOptions.length === 0}
                options={targetOptions}
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" block disabled={activeNodes.length === 0}>
              Add Edge
            </Button>
          </Form>

          {/* Selected item actions */}
          {selectedNodeId && (
            <>
              <Divider titlePlacement="left" style={{ borderColor: 'rgba(255, 255, 255, 0.15)', color: '#9ca3af' }}>Selected Node</Divider>
              <Space>
                <span style={{ color: '#fff' }}>{selectedNodeId}</span>
                <Button danger onClick={() => deleteNode(selectedNodeId)}>Delete Node</Button>
              </Space>
            </>
          )}
          {selectedEdgeId && (
            <>
              <Divider titlePlacement="left" style={{ borderColor: 'rgba(255, 255, 255, 0.15)', color: '#9ca3af' }}>Selected Edge</Divider>
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
            open={nodeModalVisible}
            onCancel={() => setNodeModalVisible(false)}
            footer={<Button onClick={() => setNodeModalVisible(false)}>Close</Button>}
          >
            {selectedNodeData ? (
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="ID">{selectedNodeData.id}</Descriptions.Item>
                <Descriptions.Item label="Label">{selectedNodeData.label}</Descriptions.Item>
                <Descriptions.Item label="Type">{selectedNodeData.type}</Descriptions.Item>
              </Descriptions>
            ) : <p>Loading...</p>}
          </Modal>

          <Modal
            title="Edge Details"
            open={edgeModalVisible}
            onCancel={() => setEdgeModalVisible(false)}
            footer={<Button onClick={() => setEdgeModalVisible(false)}>Close</Button>}
          >
            {selectedEdgeData ? (
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="ID">{selectedEdgeData.id}</Descriptions.Item>
                <Descriptions.Item label="Source">{selectedEdgeData.source}</Descriptions.Item>
                <Descriptions.Item label="Target">{selectedEdgeData.target}</Descriptions.Item>
              </Descriptions>
            ) : <p>Loading...</p>}
          </Modal>
</Content>
      </Layout>
      </Layout>
  );
};

export default App;
