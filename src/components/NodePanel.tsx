import React from 'react';
import { Button, Divider, Form, Input, Select } from 'antd';
import { useI18n } from '../i18n/I18nProvider.tsx';
import type { TopologyNodeTypeValue } from '../../shared/types.ts';

interface NodePanelProps {
  onAddNode: (values: {
    nodeId: string;
    nodeType: TopologyNodeTypeValue;
    nodeLabel: string;
  }) => Promise<boolean>;
}

export const NodePanel: React.FC<NodePanelProps> = ({ onAddNode }) => {
  const { t } = useI18n();
  const [nodeForm] = Form.useForm();

  return (
    <>
      <Divider
        titlePlacement="left"
        style={{ borderColor: 'rgba(255, 255, 255, 0.15)', color: '#9ca3af' }}
      >
        {t('nodes.addTitle')}
      </Divider>
      <Form
        form={nodeForm}
        layout="vertical"
        onFinish={async values => {
          const ok = await onAddNode(values);
          if (ok) nodeForm.resetFields();
        }}
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
        <Button type="primary" htmlType="submit" block>
          {t('nodes.add')}
        </Button>
      </Form>
    </>
  );
};
