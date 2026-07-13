import { useCallback } from 'react';
import { message, Modal } from 'antd';
import { getApiErrorMessage } from '../api/client.ts';
import { topologyApi } from '../api/topologies.ts';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { translateApiError } from '../i18n/translations.ts';
import { getGatewayValidationError } from '../../shared/edgeGateway.ts';
import { validateEdgeBetweenNodes } from '../../shared/edgeValidation.ts';
import type { TopologyEdge, TopologyNode, TopologyNodeTypeValue, TopologySummary } from '../../shared/types.ts';
import type { SelectedNodeData } from './useSelection.ts';

export interface NodePositionUpdate {
  nodeId: string;
  position: { x: number; y: number };
}

export interface UseTopologyMutationsOptions {
  activeTopologyId: string | null;
  setActiveTopologyId: (id: string | null) => void;
  nodes: TopologyNode[];
  selectedNodeData: SelectedNodeData | null;
  selectedEdgeData: TopologyEdge | null;
  refreshTopologies: () => Promise<TopologySummary[]>;
  bumpTopology: () => void;
  clearNodeSelection: () => void;
  clearEdgeSelection: () => void;
  setSelectedNodeData: (data: SelectedNodeData | null) => void;
  setSelectedEdgeData: (data: TopologyEdge | null) => void;
}

export interface UseTopologyMutationsResult {
  createTopology: (name: string) => Promise<boolean>;
  renameTopology: (name: string) => Promise<boolean>;
  deleteTopology: () => void;
  addNode: (values: {
    nodeId: string;
    nodeType: TopologyNodeTypeValue;
    nodeLabel: string;
  }) => Promise<boolean>;
  saveNodePositions: (updates: NodePositionUpdate[]) => Promise<void>;
  updateNodeLabel: (values: { label: string }) => Promise<void>;
  deleteNode: (nodeId: string) => void;
  validateEdgeForm: (source: string, target: string) => string | null;
  validateGatewayField: (value: string | undefined) => string | null;
  addEdge: (values: { source: string; target: string; gateway?: string }) => Promise<boolean>;
  updateEdgeGateway: (values: { gateway?: string }) => Promise<void>;
  deleteEdge: (edgeId: string) => void;
}

export function useTopologyMutations(options: UseTopologyMutationsOptions): UseTopologyMutationsResult {
  const { t } = useI18n();
  const {
    activeTopologyId,
    setActiveTopologyId,
    nodes,
    selectedNodeData,
    selectedEdgeData,
    refreshTopologies,
    bumpTopology,
    clearNodeSelection,
    clearEdgeSelection,
    setSelectedNodeData,
    setSelectedEdgeData,
  } = options;

  const showApiError = useCallback(
    (err: unknown, fallbackKey: Parameters<typeof t>[0]) => {
      console.error(err);
      message.error(translateApiError(getApiErrorMessage(err, t(fallbackKey)), t));
    },
    [t],
  );

  const createTopology = useCallback(
    async (name: string) => {
      try {
        const newTopo = await topologyApi.create(name);
        message.success(t('topologies.created', { name: newTopo.name }));
        await refreshTopologies();
        setActiveTopologyId(newTopo.id);
        return true;
      } catch (err) {
        showApiError(err, 'topologies.createFailed');
        return false;
      }
    },
    [refreshTopologies, setActiveTopologyId, showApiError, t],
  );

  const renameTopology = useCallback(
    async (name: string) => {
      if (!activeTopologyId) return false;

      try {
        const updated = await topologyApi.rename(activeTopologyId, name);
        message.success(t('topologies.renamed', { name: updated.name }));
        await refreshTopologies();
        return true;
      } catch (err) {
        showApiError(err, 'topologies.renameFailed');
        return false;
      }
    },
    [activeTopologyId, refreshTopologies, showApiError, t],
  );

  const deleteTopology = useCallback(() => {
    if (!activeTopologyId) return;
    if (activeTopologyId === 'topology-1') {
      Modal.info({ title: t('topologies.protectedTitle'), content: t('topologies.protectedContent') });
      return;
    }
    Modal.confirm({
      title: t('topologies.deleteTitle'),
      content: t('topologies.deleteContent'),
      onOk: async () => {
        try {
          await topologyApi.delete(activeTopologyId);
          message.success(t('topologies.deleted'));
          const data = await refreshTopologies();
          setActiveTopologyId(data[0]?.id ?? null);
        } catch (err) {
          showApiError(err, 'topologies.deleteFailed');
        }
      },
    });
  }, [activeTopologyId, refreshTopologies, setActiveTopologyId, showApiError, t]);

  const addNode = useCallback(
    async (values: { nodeId: string; nodeType: TopologyNodeTypeValue; nodeLabel: string }) => {
      if (!activeTopologyId) {
        message.warning(t('common.selectTopologyFirst'));
        return false;
      }
      const nodeId = values.nodeId.trim().toLowerCase().replace(/\s+/g, '-');

      try {
        await topologyApi.addNode(activeTopologyId, {
          nodeId,
          type: values.nodeType,
          label: values.nodeLabel,
        });
        message.success(t('nodes.added'));
        bumpTopology();
        return true;
      } catch (err) {
        showApiError(err, 'nodes.addFailed');
        return false;
      }
    },
    [activeTopologyId, bumpTopology, showApiError, t],
  );

  const saveNodePositions = useCallback(
    async (updates: NodePositionUpdate[]) => {
      if (!activeTopologyId || updates.length === 0) return;

      try {
        await Promise.all(
          updates.map(({ nodeId, position }) =>
            topologyApi.updateNodePosition(activeTopologyId, nodeId, position),
          ),
        );
        message.success(t('nodes.positionSaved'));
        bumpTopology();
      } catch (err) {
        showApiError(err, 'nodes.positionSaveFailed');
        bumpTopology();
      }
    },
    [activeTopologyId, bumpTopology, showApiError, t],
  );

  const updateNodeLabel = useCallback(
    async (values: { label: string }) => {
      if (!activeTopologyId || !selectedNodeData) return;

      try {
        const updatedNode = await topologyApi.updateNode(activeTopologyId, selectedNodeData.id, {
          label: values.label,
        });
        message.success(t('nodes.updated'));
        setSelectedNodeData({
          id: updatedNode.id,
          label: updatedNode.data?.label || updatedNode.id,
          type: updatedNode.type,
        });
        bumpTopology();
      } catch (err) {
        showApiError(err, 'nodes.updateFailed');
      }
    },
    [activeTopologyId, bumpTopology, selectedNodeData, setSelectedNodeData, showApiError, t],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      if (!activeTopologyId) return;
      Modal.confirm({
        title: t('nodes.deleteTitle', { id: nodeId }),
        content: t('nodes.deleteContent'),
        onOk: async () => {
          try {
            await topologyApi.deleteNode(activeTopologyId, nodeId);
            message.success(t('nodes.deleted'));
            clearNodeSelection();
            bumpTopology();
          } catch (err) {
            showApiError(err, 'nodes.deleteFailed');
          }
        },
      });
    },
    [activeTopologyId, bumpTopology, clearNodeSelection, showApiError, t],
  );

  const validateEdgeForm = useCallback(
    (source: string, target: string): string | null => {
      const trimmedSource = source.trim();
      const trimmedTarget = target.trim();

      if (!trimmedSource || !trimmedTarget) {
        return t('edges.sourceTargetRequired');
      }
      if (trimmedSource === trimmedTarget) {
        return t('edges.sameNode');
      }

      const sourceNode = nodes.find(n => n.id === trimmedSource);
      const targetNode = nodes.find(n => n.id === trimmedTarget);

      if (!sourceNode || !targetNode) {
        return t('edges.nodeMissing');
      }

      const topologyError = validateEdgeBetweenNodes(sourceNode, targetNode);
      return topologyError ? translateApiError(topologyError, t) : null;
    },
    [nodes, t],
  );

  const validateGatewayField = useCallback(
    (value: string | undefined): string | null => {
      const trimmed = value?.trim() || '';
      if (!trimmed) return null;
      const error = getGatewayValidationError(trimmed);
      return error ? translateApiError(error, t) : null;
    },
    [t],
  );

  const addEdge = useCallback(
    async (values: { source: string; target: string; gateway?: string }) => {
      if (!activeTopologyId) {
        message.warning(t('common.selectTopologyFirst'));
        return false;
      }

      const validationError = validateEdgeForm(values.source, values.target);
      if (validationError) {
        message.error(validationError);
        return false;
      }

      const gatewayError = validateGatewayField(values.gateway);
      if (gatewayError) {
        message.error(gatewayError);
        return false;
      }

      const payload: { source: string; target: string; gateway?: string } = {
        source: values.source.trim(),
        target: values.target.trim(),
      };
      const gateway = values.gateway?.trim();
      if (gateway) payload.gateway = gateway;

      try {
        await topologyApi.addEdge(activeTopologyId, payload);
        message.success(t('edges.added'));
        bumpTopology();
        return true;
      } catch (err) {
        showApiError(err, 'edges.addFailed');
        return false;
      }
    },
    [activeTopologyId, bumpTopology, showApiError, t, validateEdgeForm, validateGatewayField],
  );

  const updateEdgeGateway = useCallback(
    async (values: { gateway?: string }) => {
      if (!activeTopologyId || !selectedEdgeData) return;

      const gatewayError = validateGatewayField(values.gateway);
      if (gatewayError) {
        message.error(gatewayError);
        return;
      }

      try {
        const updatedEdge = await topologyApi.updateEdge(activeTopologyId, selectedEdgeData.id, {
          gateway: values.gateway?.trim() || '',
        });
        message.success(t('edges.updated'));
        setSelectedEdgeData(updatedEdge);
        bumpTopology();
      } catch (err) {
        showApiError(err, 'edges.updateFailed');
      }
    },
    [
      activeTopologyId,
      bumpTopology,
      selectedEdgeData,
      setSelectedEdgeData,
      showApiError,
      t,
      validateGatewayField,
    ],
  );

  const deleteEdge = useCallback(
    (edgeId: string) => {
      if (!activeTopologyId) return;
      Modal.confirm({
        title: t('edges.deleteTitle', { id: edgeId }),
        onOk: async () => {
          try {
            await topologyApi.deleteEdge(activeTopologyId, edgeId);
            message.success(t('edges.deleted'));
            clearEdgeSelection();
            bumpTopology();
          } catch (err) {
            showApiError(err, 'edges.deleteFailed');
          }
        },
      });
    },
    [activeTopologyId, bumpTopology, clearEdgeSelection, showApiError, t],
  );

  return {
    createTopology,
    renameTopology,
    deleteTopology,
    addNode,
    saveNodePositions,
    updateNodeLabel,
    deleteNode,
    validateEdgeForm,
    validateGatewayField,
    addEdge,
    updateEdgeGateway,
    deleteEdge,
  };
}
