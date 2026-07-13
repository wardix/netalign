import { useCallback } from 'react';
import { message, Modal } from 'antd';
import { getApiErrorMessage } from '../api/client.ts';
import { topologyApi } from '../api/topologies.ts';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { translateApiError } from '../i18n/translations.ts';
import { getGatewayValidationError } from '../../shared/edgeGateway.ts';
import { validateEdgeBetweenNodes } from '../../shared/edgeValidation.ts';
import {
  parseTopologyImport,
  sanitizeExportFilename,
  toExportDocument,
} from '../../shared/topologyImport.ts';
import type { TopologyEdge, TopologyNode, TopologyNodeTypeValue, TopologySummary } from '../../shared/types.ts';
import type { HistoryCommand } from '../history/historyStack.ts';
import type { SelectedNodeData } from './useSelection.ts';

export interface NodePositionUpdate {
  nodeId: string;
  position: { x: number; y: number };
}

export interface TopologyLocalCache {
  upsertNode: (node: TopologyNode) => void;
  removeNode: (nodeId: string) => void;
  upsertEdge: (edge: TopologyEdge) => void;
  removeEdge: (edgeId: string) => void;
  patchNode: (nodeId: string, patch: Partial<TopologyNode>) => void;
  patchNodePositions: (updates: NodePositionUpdate[]) => void;
}

export interface UseTopologyMutationsOptions {
  activeTopologyId: string | null;
  setActiveTopologyId: (id: string | null) => void;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  selectedNodeData: SelectedNodeData | null;
  selectedEdgeData: TopologyEdge | null;
  refreshTopologies: () => Promise<TopologySummary[]>;
  /** Background reload without canvas spinner (used after undo/redo / error recovery). */
  silentRefresh: () => Promise<void>;
  cache: TopologyLocalCache;
  clearNodeSelection: () => void;
  clearEdgeSelection: () => void;
  setSelectedNodeData: (data: SelectedNodeData | null) => void;
  setSelectedEdgeData: (data: TopologyEdge | null) => void;
  recordHistory: (command: HistoryCommand) => void;
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
  saveNodePositions: (
    updates: NodePositionUpdate[],
    previous?: NodePositionUpdate[],
  ) => Promise<void>;
  updateNodeLabel: (values: { label: string }) => Promise<void>;
  deleteNode: (nodeId: string) => void;
  validateEdgeForm: (source: string, target: string) => string | null;
  validateGatewayField: (value: string | undefined) => string | null;
  addEdge: (values: { source: string; target: string; gateway?: string }) => Promise<boolean>;
  updateEdgeGateway: (values: { gateway?: string }) => Promise<void>;
  deleteEdge: (edgeId: string) => void;
  exportTopology: () => Promise<boolean>;
  importTopology: (file: File) => Promise<boolean>;
}

export function useTopologyMutations(options: UseTopologyMutationsOptions): UseTopologyMutationsResult {
  const { t } = useI18n();
  const {
    activeTopologyId,
    setActiveTopologyId,
    nodes,
    edges,
    selectedNodeData,
    selectedEdgeData,
    refreshTopologies,
    silentRefresh,
    cache,
    clearNodeSelection,
    clearEdgeSelection,
    setSelectedNodeData,
    setSelectedEdgeData,
    recordHistory,
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
        const created = await topologyApi.addNode(activeTopologyId, {
          nodeId,
          type: values.nodeType,
          label: values.nodeLabel,
        });
        cache.upsertNode(created);
        recordHistory({
          type: 'addNode',
          topologyId: activeTopologyId,
          node: {
            id: created.id,
            type: created.type,
            label: created.data?.label || values.nodeLabel,
            position: created.position,
          },
        });
        message.success(t('nodes.added'));
        return true;
      } catch (err) {
        showApiError(err, 'nodes.addFailed');
        return false;
      }
    },
    [activeTopologyId, cache, recordHistory, showApiError, t],
  );

  const saveNodePositions = useCallback(
    async (updates: NodePositionUpdate[], previous?: NodePositionUpdate[]) => {
      if (!activeTopologyId || updates.length === 0) return;

      // Optimistic local positions (canvas already shows drag end; keep store in sync).
      cache.patchNodePositions(updates);

      try {
        await topologyApi.updateNodePositions(activeTopologyId, updates);
        if (previous && previous.length > 0) {
          recordHistory({
            type: 'moveNodes',
            topologyId: activeTopologyId,
            previous,
            next: updates,
          });
        }
        message.success(t('nodes.positionSaved'));
      } catch (err) {
        if (previous && previous.length > 0) {
          cache.patchNodePositions(previous);
        } else {
          await silentRefresh();
        }
        showApiError(err, 'nodes.positionSaveFailed');
      }
    },
    [activeTopologyId, cache, recordHistory, showApiError, silentRefresh, t],
  );

  const updateNodeLabel = useCallback(
    async (values: { label: string }) => {
      if (!activeTopologyId || !selectedNodeData) return;

      const previousLabel = selectedNodeData.label;
      const nextLabel = values.label;
      const nodeId = selectedNodeData.id;

      cache.patchNode(nodeId, { data: { label: nextLabel } });
      setSelectedNodeData({ ...selectedNodeData, label: nextLabel });

      try {
        const updatedNode = await topologyApi.updateNode(activeTopologyId, nodeId, {
          label: nextLabel,
        });
        cache.upsertNode(updatedNode);
        if (previousLabel !== nextLabel) {
          recordHistory({
            type: 'updateNodeLabel',
            topologyId: activeTopologyId,
            nodeId,
            previousLabel,
            nextLabel,
          });
        }
        message.success(t('nodes.updated'));
        setSelectedNodeData({
          id: updatedNode.id,
          label: updatedNode.data?.label || updatedNode.id,
          type: updatedNode.type,
        });
      } catch (err) {
        cache.patchNode(nodeId, { data: { label: previousLabel } });
        setSelectedNodeData({ ...selectedNodeData, label: previousLabel });
        showApiError(err, 'nodes.updateFailed');
      }
    },
    [activeTopologyId, cache, recordHistory, selectedNodeData, setSelectedNodeData, showApiError, t],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      if (!activeTopologyId) return;
      const node = nodes.find(n => n.id === nodeId);
      const connectedEdges = edges.filter(e => e.source === nodeId || e.target === nodeId);
      Modal.confirm({
        title: t('nodes.deleteTitle', { id: nodeId }),
        content: t('nodes.deleteContent'),
        onOk: async () => {
          try {
            await topologyApi.deleteNode(activeTopologyId, nodeId);
            cache.removeNode(nodeId);
            if (node) {
              recordHistory({
                type: 'deleteNode',
                topologyId: activeTopologyId,
                node,
                connectedEdges,
              });
            }
            message.success(t('nodes.deleted'));
            clearNodeSelection();
          } catch (err) {
            showApiError(err, 'nodes.deleteFailed');
            await silentRefresh();
          }
        },
      });
    },
    [
      activeTopologyId,
      cache,
      clearNodeSelection,
      edges,
      nodes,
      recordHistory,
      showApiError,
      silentRefresh,
      t,
    ],
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
        const created = await topologyApi.addEdge(activeTopologyId, payload);
        cache.upsertEdge(created);
        recordHistory({
          type: 'addEdge',
          topologyId: activeTopologyId,
          edge: created,
        });
        message.success(t('edges.added'));
        return true;
      } catch (err) {
        showApiError(err, 'edges.addFailed');
        return false;
      }
    },
    [
      activeTopologyId,
      cache,
      recordHistory,
      showApiError,
      t,
      validateEdgeForm,
      validateGatewayField,
    ],
  );

  const updateEdgeGateway = useCallback(
    async (values: { gateway?: string }) => {
      if (!activeTopologyId || !selectedEdgeData) return;

      const gatewayError = validateGatewayField(values.gateway);
      if (gatewayError) {
        message.error(gatewayError);
        return;
      }

      const previousGateway = selectedEdgeData.gateway || '';
      const nextGateway = values.gateway?.trim() || '';
      const edgeId = selectedEdgeData.id;

      const optimistic: TopologyEdge = {
        ...selectedEdgeData,
        gateway: nextGateway || undefined,
      };
      if (!nextGateway) delete optimistic.gateway;
      cache.upsertEdge(optimistic);
      setSelectedEdgeData(optimistic);

      try {
        const updatedEdge = await topologyApi.updateEdge(activeTopologyId, edgeId, {
          gateway: nextGateway,
        });
        cache.upsertEdge(updatedEdge);
        if (previousGateway !== nextGateway) {
          recordHistory({
            type: 'updateEdgeGateway',
            topologyId: activeTopologyId,
            edgeId,
            previousGateway,
            nextGateway,
          });
        }
        message.success(t('edges.updated'));
        setSelectedEdgeData(updatedEdge);
      } catch (err) {
        const rolled: TopologyEdge = {
          ...selectedEdgeData,
          gateway: previousGateway || undefined,
        };
        if (!previousGateway) delete rolled.gateway;
        cache.upsertEdge(rolled);
        setSelectedEdgeData(rolled);
        showApiError(err, 'edges.updateFailed');
      }
    },
    [
      activeTopologyId,
      cache,
      recordHistory,
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
      const edge = edges.find(e => e.id === edgeId) || selectedEdgeData;
      Modal.confirm({
        title: t('edges.deleteTitle', { id: edgeId }),
        onOk: async () => {
          try {
            await topologyApi.deleteEdge(activeTopologyId, edgeId);
            cache.removeEdge(edgeId);
            if (edge && edge.id === edgeId) {
              recordHistory({
                type: 'deleteEdge',
                topologyId: activeTopologyId,
                edge,
              });
            }
            message.success(t('edges.deleted'));
            clearEdgeSelection();
          } catch (err) {
            showApiError(err, 'edges.deleteFailed');
            await silentRefresh();
          }
        },
      });
    },
    [
      activeTopologyId,
      cache,
      clearEdgeSelection,
      edges,
      recordHistory,
      selectedEdgeData,
      showApiError,
      silentRefresh,
      t,
    ],
  );

  const exportTopology = useCallback(async () => {
    if (!activeTopologyId) {
      message.warning(t('common.selectTopologyFirst'));
      return false;
    }

    try {
      const topology = await topologyApi.get(activeTopologyId);
      const document = toExportDocument(topology);
      const blob = new Blob([JSON.stringify(document, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = sanitizeExportFilename(topology.name);
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      message.success(t('topologies.exported', { name: topology.name }));
      return true;
    } catch (err) {
      showApiError(err, 'topologies.exportFailed');
      return false;
    }
  }, [activeTopologyId, showApiError, t]);

  const importTopology = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        let raw: unknown;
        try {
          raw = JSON.parse(text) as unknown;
        } catch {
          message.error(t('topologies.importInvalidJson'));
          return false;
        }

        const clientCheck = parseTopologyImport(raw);
        if (!clientCheck.ok) {
          message.error(translateApiError(clientCheck.error, t));
          return false;
        }

        const imported = await topologyApi.import(raw);
        message.success(t('topologies.imported', { name: imported.name }));
        await refreshTopologies();
        setActiveTopologyId(imported.id);
        return true;
      } catch (err) {
        showApiError(err, 'topologies.importFailed');
        return false;
      }
    },
    [refreshTopologies, setActiveTopologyId, showApiError, t],
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
    exportTopology,
    importTopology,
  };
}
