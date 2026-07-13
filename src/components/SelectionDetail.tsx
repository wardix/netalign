import React, { useEffect } from 'react';
import { Button, Descriptions, Divider, Form, Input, Space } from 'antd';
import { useI18n } from '../i18n/I18nProvider.tsx';
import type { TopologyEdge } from '../../shared/types.ts';
import type { SelectedNodeData } from '../hooks/useSelection.ts';

interface SelectionDetailProps {
  selectedNodeId: string | null;
  selectedNodeData: SelectedNodeData | null;
  selectedEdgeId: string | null;
  selectedEdgeData: TopologyEdge | null;
  onUpdateNodeLabel: (values: { label: string }) => Promise<void>;
  onDeleteNode: (nodeId: string) => void;
  onUpdateEdgeGateway: (values: { gateway?: string }) => Promise<void>;
  onDeleteEdge: (edgeId: string) => void;
}

export const SelectionDetail: React.FC<SelectionDetailProps> = ({
  selectedNodeId,
  selectedNodeData,
  selectedEdgeId,
  selectedEdgeData,
  onUpdateNodeLabel,
  onDeleteNode,
  onUpdateEdgeGateway,
  onDeleteEdge,
}) => {
  const { t } = useI18n();
  const [nodeDetailForm] = Form.useForm();
  const [edgeDetailForm] = Form.useForm();

  useEffect(() => {
    if (!selectedNodeData) {
      nodeDetailForm.resetFields();
      return;
    }
    nodeDetailForm.setFieldsValue({ label: selectedNodeData.label });
  }, [selectedNodeData, nodeDetailForm]);

  useEffect(() => {
    if (!selectedEdgeData) {
      edgeDetailForm.resetFields();
      return;
    }
    edgeDetailForm.setFieldsValue({ gateway: selectedEdgeData.gateway || '' });
  }, [selectedEdgeData, edgeDetailForm]);

  return (
    <>
      {selectedNodeId && selectedNodeData && (
        <>
          <Divider
            titlePlacement="left"
            style={{ borderColor: 'rgba(255, 255, 255, 0.15)', color: '#9ca3af' }}
          >
            {t('nodes.selectedTitle')}
          </Divider>
          <Form form={nodeDetailForm} layout="vertical" onFinish={onUpdateNodeLabel}>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: 12 }}>
              <Descriptions.Item label="ID">{selectedNodeData.id}</Descriptions.Item>
              <Descriptions.Item label={t('nodes.type')}>{selectedNodeData.type}</Descriptions.Item>
            </Descriptions>
            <Form.Item
              name="label"
              label={t('nodes.label')}
              rules={[{ required: true, message: t('nodes.labelRequired') }]}
            >
              <Input />
            </Form.Item>
            <Space style={{ width: '100%' }}>
              <Button type="primary" htmlType="submit">
                {t('common.save')}
              </Button>
              <Button danger onClick={() => onDeleteNode(selectedNodeId)}>
                {t('common.delete')}
              </Button>
            </Space>
          </Form>
        </>
      )}
      {selectedEdgeId && selectedEdgeData && (
        <>
          <Divider
            titlePlacement="left"
            style={{ borderColor: 'rgba(255, 255, 255, 0.15)', color: '#9ca3af' }}
          >
            {t('edges.selectedTitle')}
          </Divider>
          <Form form={edgeDetailForm} layout="vertical" onFinish={onUpdateEdgeGateway}>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: 12 }}>
              <Descriptions.Item label="ID">{selectedEdgeData.id}</Descriptions.Item>
              <Descriptions.Item label={t('edges.source')}>{selectedEdgeData.source}</Descriptions.Item>
              <Descriptions.Item label={t('edges.target')}>{selectedEdgeData.target}</Descriptions.Item>
            </Descriptions>
            <Form.Item name="gateway" label={t('edges.gateway')}>
              <Input placeholder={t('edges.gatewayPlaceholder')} allowClear />
            </Form.Item>
            <Space style={{ width: '100%' }}>
              <Button type="primary" htmlType="submit">
                {t('common.save')}
              </Button>
              <Button danger onClick={() => onDeleteEdge(selectedEdgeId)}>
                {t('edges.delete')}
              </Button>
            </Space>
          </Form>
        </>
      )}
    </>
  );
};
