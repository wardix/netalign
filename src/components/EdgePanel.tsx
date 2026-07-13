import React, { useEffect, useMemo } from 'react';
import { Button, Divider, Form, Input, Select } from 'antd';
import { useI18n } from '../i18n/I18nProvider.tsx';
import {
  formatNodeOptionLabel,
  getValidTargetNodes,
  sortNodesByLabel,
} from '../../shared/topologyNodes.ts';
import type { TopologyNode } from '../../shared/types.ts';

interface EdgePanelProps {
  nodes: TopologyNode[];
  activeTopologyId: string | null;
  validateEdgeForm: (source: string, target: string) => string | null;
  onAddEdge: (values: { source: string; target: string; gateway?: string }) => Promise<boolean>;
}

export const EdgePanel: React.FC<EdgePanelProps> = ({
  nodes,
  activeTopologyId,
  validateEdgeForm,
  onAddEdge,
}) => {
  const { t } = useI18n();
  const [edgeForm] = Form.useForm();
  const edgeSource = Form.useWatch('source', edgeForm);

  useEffect(() => {
    edgeForm.resetFields();
  }, [activeTopologyId, edgeForm]);

  const sourceOptions = useMemo(
    () =>
      sortNodesByLabel(nodes).map(node => ({
        value: node.id,
        label: formatNodeOptionLabel(node),
      })),
    [nodes],
  );

  const targetOptions = useMemo(
    () =>
      getValidTargetNodes(edgeSource, nodes).map(node => ({
        value: node.id,
        label: formatNodeOptionLabel(node),
      })),
    [edgeSource, nodes],
  );

  return (
    <>
      <Divider
        titlePlacement="left"
        style={{ borderColor: 'rgba(255, 255, 255, 0.15)', color: '#9ca3af' }}
      >
        {t('edges.addTitle')}
      </Divider>
      <Form
        form={edgeForm}
        layout="vertical"
        onFinish={async values => {
          const ok = await onAddEdge(values);
          if (ok) edgeForm.resetFields();
        }}
        style={{ marginBottom: 12 }}
      >
        <Form.Item
          name="source"
          label={t('edges.source')}
          rules={[{ required: true, message: t('edges.sourceRequired') }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder={nodes.length ? t('edges.selectSource') : t('edges.noNodes')}
            disabled={nodes.length === 0}
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
        <Form.Item name="gateway" label={t('edges.gateway')}>
          <Input placeholder={t('edges.gatewayPlaceholder')} />
        </Form.Item>
        <Button type="primary" htmlType="submit" block disabled={nodes.length === 0}>
          {t('edges.add')}
        </Button>
      </Form>
    </>
  );
};
