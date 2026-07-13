import React from 'react';
import { Button, Divider, Form, Input, Modal, Select, Space } from 'antd';
import { useI18n } from '../i18n/I18nProvider.tsx';
import type { TopologySummary } from '../../shared/types.ts';

interface TopologyManagerProps {
  topologies: TopologySummary[];
  activeTopologyId: string | null;
  onSelectTopology: (id: string) => void;
  onCreateTopology: (name: string) => Promise<boolean>;
  onRenameTopology: (name: string) => Promise<boolean>;
  onDeleteTopology: () => void;
}

export const TopologyManager: React.FC<TopologyManagerProps> = ({
  topologies,
  activeTopologyId,
  onSelectTopology,
  onCreateTopology,
  onRenameTopology,
  onDeleteTopology,
}) => {
  const { t } = useI18n();
  const [topoForm] = Form.useForm();

  return (
    <>
      <Divider
        titlePlacement="left"
        style={{ borderColor: 'rgba(255, 255, 255, 0.15)', color: '#9ca3af' }}
      >
        {t('topologies.title')}
      </Divider>
      <Select
        style={{ width: '100%' }}
        placeholder={t('topologies.select')}
        value={activeTopologyId || undefined}
        onChange={id => onSelectTopology(id)}
      >
        {topologies.map(topology => (
          <Select.Option key={topology.id} value={topology.id}>
            {topology.name}
          </Select.Option>
        ))}
      </Select>
      <Space wrap style={{ marginTop: 8, width: '100%' }}>
        <Button
          type="primary"
          onClick={() => {
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
                await onCreateTopology(values.name);
                topoForm.resetFields();
              },
              okText: t('topologies.create'),
              cancelText: t('topologies.cancel'),
            });
          }}
        >
          {t('topologies.new')}
        </Button>
        <Button
          disabled={!activeTopologyId}
          onClick={() => {
            const currentName = topologies.find(topology => topology.id === activeTopologyId)?.name || '';
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
                await onRenameTopology(values.name);
                topoForm.resetFields();
              },
              okText: t('topologies.save'),
              cancelText: t('topologies.cancel'),
            });
          }}
        >
          {t('topologies.rename')}
        </Button>
        <Button danger onClick={onDeleteTopology}>
          {t('topologies.delete')}
        </Button>
      </Space>
    </>
  );
};
