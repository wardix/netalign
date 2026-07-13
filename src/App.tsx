import React, { useState, useEffect, useMemo } from 'react';

import { Layout, Select, Button, Input, Form, message, Modal, Divider, Space, Descriptions } from 'antd';
import TopologyGraph from './components/TopologyGraph';
import { useI18n } from './i18n/I18nProvider.tsx';
import { translateApiError } from './i18n/translations.ts';
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

interface TopologyEdge {
  id: string;
  source: string;
  target: string;
}

const App: React.FC = () => {
  const { t, locale, setLocale } = useI18n();
  const [topologies, setTopologies] = useState<TopologyInfo[]>([]);
  const [activeTopologyId, setActiveTopologyId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedNodeData, setSelectedNodeData] = useState<{
    id: string;
    label: string;
    type: string;
  } | null>(null);
  const [selectedEdgeData, setSelectedEdgeData] = useState<TopologyEdge | null>(null);
  const [activeNodes, setActiveNodes] = useState<TopologyNode[]>([]);
  const [activeEdges, setActiveEdges] = useState<TopologyEdge[]>([]);
  const [topologyLoading, setTopologyLoading] = useState(false);
  const [topologyError, setTopologyError] = useState<string | null>(null);
  const [topoForm] = Form.useForm();
  const [nodeForm] = Form.useForm();
  const [edgeForm] = Form.useForm();
  const [nodeDetailForm] = Form.useForm();

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
        message.error(t('topologies.loadFailed'));
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
    setSelectedNodeId(null);
    setSelectedNodeData(null);
    setSelectedEdgeId(null);
    setSelectedEdgeData(null);
  }, [activeTopologyId]);

  useEffect(() => {
    if (!activeTopologyId) {
      setActiveNodes([]);
      setActiveEdges([]);
      setTopologyLoading(false);
      setTopologyError(null);
      return;
    }

    let cancelled = false;
    setTopologyLoading(true);
    setTopologyError(null);

    loadTopologyDetail(activeTopologyId)
      .then(data => {
        if (cancelled) return;
        setActiveNodes(data.nodes ?? []);
        setActiveEdges(data.edges ?? []);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('Failed to load topology detail', err);
        setActiveNodes([]);
        setActiveEdges([]);
        setTopologyError(t('canvas.loadFailedDetail'));
      })
      .finally(() => {
        if (!cancelled) setTopologyLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTopologyId, refreshKey, t]);

  useEffect(() => {
    edgeForm.resetFields();
  }, [activeTopologyId, edgeForm]);

  useEffect(() => {
    if (!selectedNodeData) {
      nodeDetailForm.resetFields();
      return;
    }
    nodeDetailForm.setFieldsValue({ label: selectedNodeData.label });
  }, [selectedNodeData, nodeDetailForm]);

  useEffect(() => {
    if (!selectedNodeId) return;
    const node = activeNodes.find(n => n.id === selectedNodeId);
    if (!node) {
      setSelectedNodeId(null);
      setSelectedNodeData(null);
      return;
    }
    setSelectedNodeData({
      id: node.id,
      label: node.data?.label || node.id,
      type: node.type,
    });
  }, [activeNodes, selectedNodeId]);

  useEffect(() => {
    if (!selectedEdgeId) return;
    const edge = activeEdges.find(e => e.id === selectedEdgeId);
    if (!edge) {
      setSelectedEdgeId(null);
      setSelectedEdgeData(null);
      return;
    }
    setSelectedEdgeData(edge);
  }, [activeEdges, selectedEdgeId]);

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
    const node = activeNodes.find(n => n.id === nodeId);
    if (!node) return;

    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    setSelectedEdgeData(null);
    setSelectedNodeData({
      id: node.id,
      label: node.data?.label || node.id,
      type: node.type,
    });
  };

  const handleEdgeSelect = (edgeId: string) => {
    const edge = activeEdges.find(e => e.id === edgeId);
    if (!edge) return;

    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);
    setSelectedNodeData(null);
    setSelectedEdgeData(edge);
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
        message.success(t('topologies.created', { name: newTopo.name }));
        loadTopologies(newTopo.id);
      })
      .catch(err => {
        console.error(err);
        message.error(t('topologies.createFailed'));
      });
  };

  const renameTopology = (name: string) => {
    if (!activeTopologyId) return;

    fetch(`${API_BASE}/api/topologies/${activeTopologyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
      .then(res => {
        if (!res.ok) return res.json().then(e => { throw new Error(e.error || t('topologies.renameFailed')); });
        return res.json();
      })
      .then(updated => {
        message.success(t('topologies.renamed', { name: updated.name }));
        loadTopologies(activeTopologyId);
      })
      .catch(err => {
        console.error(err);
        message.error(translateApiError(err.message || t('topologies.renameFailed'), t));
      });
  };

  const deleteTopology = () => {
    if (!activeTopologyId) return;
    if (activeTopologyId === 'topology-1') {
      Modal.info({ title: t('topologies.protectedTitle'), content: t('topologies.protectedContent') });
      return;
    }
    Modal.confirm({
      title: t('topologies.deleteTitle'),
      content: t('topologies.deleteContent'),
      onOk: () => {
        fetch(`${API_BASE}/api/topologies/${activeTopologyId}`, { method: 'DELETE' })
          .then(res => {
            if (!res.ok) throw new Error('Delete failed');
            return res.json();
          })
          .then(() => {
            message.success(t('topologies.deleted'));
            loadTopologies();
          })
          .catch(err => {
            console.error(err);
            message.error(t('topologies.deleteFailed'));
          });
      },
    });
  };

  // --- Node actions ---
  const addNode = (values: any) => {
    if (!activeTopologyId) return message.warning(t('common.selectTopologyFirst'));
    const nodeId = values.nodeId.trim().toLowerCase().replace(/\s+/g, '-');
    const payload = { nodeId, type: values.nodeType, label: values.nodeLabel };
    fetch(`${API_BASE}/api/topologies/${activeTopologyId}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(res => {
        if (!res.ok) return res.json().then(e => { throw new Error(e.error || t('nodes.addFailed')); });
        return res.json();
      })
      .then(() => {
        message.success(t('nodes.added'));
        nodeForm.resetFields();
        setRefreshKey(k => k + 1);
      })
      .catch(err => {
        console.error(err);
        message.error(translateApiError(err.message || t('nodes.addFailed'), t));
      });
  };

  const updateNodeLabel = (values: { label: string }) => {
    if (!activeTopologyId || !selectedNodeData) return;

    fetch(`${API_BASE}/api/topologies/${activeTopologyId}/nodes/${selectedNodeData.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: values.label }),
    })
      .then(res => {
        if (!res.ok) return res.json().then(e => { throw new Error(e.error || t('nodes.updateFailed')); });
        return res.json();
      })
      .then(updatedNode => {
        message.success(t('nodes.updated'));
        setSelectedNodeData({
          id: updatedNode.id,
          label: updatedNode.data?.label || updatedNode.id,
          type: updatedNode.type,
        });
        setRefreshKey(k => k + 1);
      })
      .catch(err => {
        console.error(err);
        message.error(translateApiError(err.message || t('nodes.updateFailed'), t));
      });
  };

  const deleteNode = (nodeId: string) => {
    if (!activeTopologyId) return;
    Modal.confirm({
      title: t('nodes.deleteTitle', { id: nodeId }),
      content: t('nodes.deleteContent'),
      onOk: () => {
        fetch(`${API_BASE}/api/topologies/${activeTopologyId}/nodes/${nodeId}`, { method: 'DELETE' })
          .then(res => {
            if (!res.ok) throw new Error('Delete node failed');
            return res.json();
          })
          .then(() => {
            message.success(t('nodes.deleted'));
            setSelectedNodeId(null);
            setSelectedNodeData(null);
            setRefreshKey(k => k + 1);
          })
          .catch(err => {
            console.error(err);
            message.error(t('nodes.deleteFailed'));
          });
      },
    });
  };

  const validateEdgeForm = (source: string, target: string): string | null => {
    const trimmedSource = source.trim();
    const trimmedTarget = target.trim();

    if (!trimmedSource || !trimmedTarget) {
      return t('edges.sourceTargetRequired');
    }
    if (trimmedSource === trimmedTarget) {
      return t('edges.sameNode');
    }

    const sourceNode = activeNodes.find(n => n.id === trimmedSource);
    const targetNode = activeNodes.find(n => n.id === trimmedTarget);

    if (!sourceNode || !targetNode) {
      return t('edges.nodeMissing');
    }

    const topologyError = validateEdgeBetweenNodes(sourceNode, targetNode);
    return topologyError ? translateApiError(topologyError, t) : null;
  };

  // --- Edge actions ---
  const addEdge = (values: { source: string; target: string }) => {
    if (!activeTopologyId) return message.warning(t('common.selectTopologyFirst'));

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
        if (!res.ok) return res.json().then(e => { throw new Error(e.error || t('edges.addFailed')); });
        return res.json();
      })
      .then(() => {
        message.success(t('edges.added'));
        edgeForm.resetFields();
        setRefreshKey(k => k + 1);
      })
      .catch(err => {
        console.error(err);
        message.error(translateApiError(err.message || t('edges.addFailed'), t));
      });
  };

  const deleteEdge = (edgeId: string) => {
    if (!activeTopologyId) return;
    Modal.confirm({
      title: t('edges.deleteTitle', { id: edgeId }),
      onOk: () => {
        fetch(`${API_BASE}/api/topologies/${activeTopologyId}/edges/${edgeId}`, { method: 'DELETE' })
          .then(res => {
            if (!res.ok) throw new Error('Delete edge failed');
            return res.json();
          })
          .then(() => {
            message.success(t('edges.deleted'));
            setSelectedEdgeId(null);
            setSelectedEdgeData(null);
            setRefreshKey(k => k + 1);
          })
          .catch(err => {
            console.error(err);
            message.error(t('edges.deleteFailed'));
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
        alignItems: 'center',
        gap: 16,
      }}>
        <span>{t('app.title')}</span>
        <Select
          size="small"
          value={locale}
          onChange={setLocale}
          style={{ width: 72, marginLeft: 'auto' }}
          options={[
            { value: 'id', label: t('locale.id') },
            { value: 'en', label: t('locale.en') },
          ]}
        />
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
          <Divider titlePlacement="left" style={{ borderColor: 'rgba(255, 255, 255, 0.15)', color: '#9ca3af' }}>{t('topologies.title')}</Divider>
          <Select
            style={{ width: '100%' }}
            placeholder={t('topologies.select')}
            value={activeTopologyId || undefined}
            onChange={id => setActiveTopologyId(id)}
          >
            {topologies.map(t => (
              <Select.Option key={t.id} value={t.id}>
                {t.name}
              </Select.Option>
            ))}
          </Select>
          <Space wrap style={{ marginTop: 8, width: '100%' }}>
            <Button type="primary" onClick={() => {
              Modal.confirm({
                title: t('topologies.createTitle'),
                content: (
                  <Form form={topoForm} layout="vertical">
                    <Form.Item name="name" label={t('topologies.name')} rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                  </Form>
                ),
                onOk: async () => {
                  const values = await topoForm.validateFields();
                  createTopology(values.name);
                  topoForm.resetFields();
                },
                okText: t('topologies.create'),
                cancelText: t('topologies.cancel'),
              });
            }}>{t('topologies.new')}</Button>
            <Button
              disabled={!activeTopologyId}
              onClick={() => {
                const currentName = topologies.find(t => t.id === activeTopologyId)?.name || '';
                topoForm.setFieldsValue({ name: currentName });
                Modal.confirm({
                  title: t('topologies.renameTitle'),
                  content: (
                    <Form form={topoForm} layout="vertical">
                      <Form.Item name="name" label={t('topologies.name')} rules={[{ required: true }]}>
                        <Input />
                      </Form.Item>
                    </Form>
                  ),
                  onOk: async () => {
                    const values = await topoForm.validateFields();
                    renameTopology(values.name);
                    topoForm.resetFields();
                  },
                  okText: t('topologies.save'),
                  cancelText: t('topologies.cancel'),
                });
              }}
            >
              {t('topologies.rename')}
            </Button>
            <Button danger onClick={deleteTopology}>{t('topologies.delete')}</Button>
          </Space>

          <Divider titlePlacement="left" style={{ borderColor: 'rgba(255, 255, 255, 0.15)', color: '#9ca3af' }}>{t('nodes.addTitle')}</Divider>
          <Form
            form={nodeForm}
            layout="vertical"
            onFinish={addNode}
            initialValues={{ nodeType: 'subnet' }}
            style={{ marginBottom: 12 }}
          >
            <Form.Item name="nodeId" label={t('nodes.id')} rules={[{ required: true }]}>
              <Input id="nodeId" />
            </Form.Item>
            <Form.Item name="nodeLabel" label={t('nodes.label')} rules={[{ required: true }]}>
              <Input id="nodeLabel" />
            </Form.Item>
            <Form.Item name="nodeType" label={t('nodes.type')} rules={[{ required: true }]}>
              <Select>
                <Select.Option value="subnet">{t('nodes.type.subnet')}</Select.Option>
                <Select.Option value="router">{t('nodes.type.router')}</Select.Option>
                <Select.Option value="instance">{t('nodes.type.instance')}</Select.Option>
              </Select>
            </Form.Item>
            <Button type="primary" htmlType="submit" block>{t('nodes.add')}</Button>
          </Form>

          <Divider titlePlacement="left" style={{ borderColor: 'rgba(255, 255, 255, 0.15)', color: '#9ca3af' }}>{t('edges.addTitle')}</Divider>
          <Form form={edgeForm} layout="vertical" onFinish={addEdge} style={{ marginBottom: 12 }}>
            <Form.Item name="source" label={t('edges.source')} rules={[{ required: true, message: t('edges.sourceRequired') }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={activeNodes.length ? t('edges.selectSource') : t('edges.noNodes')}
                disabled={activeNodes.length === 0}
                options={sourceOptions}
                onChange={() => edgeForm.setFieldValue('target', undefined)}
              />
            </Form.Item>
            <Form.Item
              name="target"
              label={t('edges.target')}
              dependencies={['source']}
              rules={[
                { required: true, message: t('edges.targetRequired') },
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
                    ? t('edges.selectSourceFirst')
                    : targetOptions.length
                      ? t('edges.selectTarget')
                      : t('edges.noValidTargets')
                }
                disabled={!edgeSource || targetOptions.length === 0}
                options={targetOptions}
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" block disabled={activeNodes.length === 0}>
              {t('edges.add')}
            </Button>
          </Form>

          {selectedNodeId && selectedNodeData && (
            <>
              <Divider titlePlacement="left" style={{ borderColor: 'rgba(255, 255, 255, 0.15)', color: '#9ca3af' }}>{t('nodes.selectedTitle')}</Divider>
              <Form form={nodeDetailForm} layout="vertical" onFinish={updateNodeLabel}>
                <Descriptions column={1} bordered size="small" style={{ marginBottom: 12 }}>
                  <Descriptions.Item label="ID">{selectedNodeData.id}</Descriptions.Item>
                  <Descriptions.Item label={t('nodes.type')}>{selectedNodeData.type}</Descriptions.Item>
                </Descriptions>
                <Form.Item name="label" label={t('nodes.label')} rules={[{ required: true, message: t('nodes.labelRequired') }]}>
                  <Input />
                </Form.Item>
                <Space style={{ width: '100%' }}>
                  <Button type="primary" htmlType="submit">{t('common.save')}</Button>
                  <Button danger onClick={() => deleteNode(selectedNodeId)}>{t('common.delete')}</Button>
                </Space>
              </Form>
            </>
          )}
          {selectedEdgeId && selectedEdgeData && (
            <>
              <Divider titlePlacement="left" style={{ borderColor: 'rgba(255, 255, 255, 0.15)', color: '#9ca3af' }}>{t('edges.selectedTitle')}</Divider>
              <Descriptions column={1} bordered size="small" style={{ marginBottom: 12 }}>
                <Descriptions.Item label="ID">{selectedEdgeData.id}</Descriptions.Item>
                <Descriptions.Item label={t('edges.source')}>{selectedEdgeData.source}</Descriptions.Item>
                <Descriptions.Item label={t('edges.target')}>{selectedEdgeData.target}</Descriptions.Item>
              </Descriptions>
              <Button danger block onClick={() => deleteEdge(selectedEdgeId)}>{t('edges.delete')}</Button>
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
            nodes={activeNodes}
            edges={activeEdges}
            loading={topologyLoading}
            error={topologyError}
            hasTopology={!!activeTopologyId}
            onRetry={() => setRefreshKey(k => k + 1)}
            onNodeSelect={handleNodeSelect}
            onEdgeSelect={handleEdgeSelect}
          />
        </Content>
      </Layout>
      </Layout>
  );
};

export default App;
