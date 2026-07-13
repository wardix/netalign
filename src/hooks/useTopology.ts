import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { getApiErrorMessage } from '../api/client.ts';
import { topologyApi } from '../api/topologies.ts';
import type { TopologyEdge, TopologyNode } from '../../shared/types.ts';
import type { NodePosition } from '../../shared/nodePosition.ts';

export interface UseTopologyResult {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  loading: boolean;
  error: string | null;
  /** Full reload. Use silent for background sync without canvas spinner. */
  refresh: (options?: { silent?: boolean }) => Promise<void>;
  setNodes: Dispatch<SetStateAction<TopologyNode[]>>;
  setEdges: Dispatch<SetStateAction<TopologyEdge[]>>;
  patchNode: (nodeId: string, patch: Partial<TopologyNode>) => void;
  patchNodePositions: (updates: { nodeId: string; position: NodePosition }[]) => void;
  upsertNode: (node: TopologyNode) => void;
  removeNode: (nodeId: string) => void;
  upsertEdge: (edge: TopologyEdge) => void;
  removeEdge: (edgeId: string) => void;
}

export function useTopology(
  topologyId: string | null,
  loadFailedMessage: string,
): UseTopologyResult {
  const [nodes, setNodes] = useState<TopologyNode[]>([]);
  const [edges, setEdges] = useState<TopologyEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!topologyId) {
        setNodes([]);
        setEdges([]);
        setLoading(false);
        setError(null);
        return;
      }

      if (!options?.silent) {
        setLoading(true);
      }
      setError(null);
      try {
        const data = await topologyApi.get(topologyId);
        setNodes(data.nodes ?? []);
        setEdges(data.edges ?? []);
      } catch (err) {
        console.error('Failed to load topology detail', err);
        if (!options?.silent) {
          setNodes([]);
          setEdges([]);
        }
        setError(getApiErrorMessage(err, loadFailedMessage));
      } finally {
        if (!options?.silent) {
          setLoading(false);
        }
      }
    },
    [topologyId, loadFailedMessage],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const patchNode = useCallback((nodeId: string, patch: Partial<TopologyNode>) => {
    setNodes(prev =>
      prev.map(node => (node.id === nodeId ? { ...node, ...patch, data: { ...node.data, ...patch.data } } : node)),
    );
  }, []);

  const patchNodePositions = useCallback(
    (updates: { nodeId: string; position: NodePosition }[]) => {
      if (updates.length === 0) return;
      const byId = new Map(updates.map(u => [u.nodeId, u.position]));
      setNodes(prev =>
        prev.map(node => {
          const position = byId.get(node.id);
          return position ? { ...node, position } : node;
        }),
      );
    },
    [],
  );

  const upsertNode = useCallback((node: TopologyNode) => {
    setNodes(prev => {
      const index = prev.findIndex(n => n.id === node.id);
      if (index === -1) return [...prev, node];
      const next = [...prev];
      next[index] = node;
      return next;
    });
  }, []);

  const removeNode = useCallback((nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
  }, []);

  const upsertEdge = useCallback((edge: TopologyEdge) => {
    setEdges(prev => {
      const index = prev.findIndex(e => e.id === edge.id);
      if (index === -1) return [...prev, edge];
      const next = [...prev];
      next[index] = edge;
      return next;
    });
  }, []);

  const removeEdge = useCallback((edgeId: string) => {
    setEdges(prev => prev.filter(e => e.id !== edgeId));
  }, []);

  return {
    nodes,
    edges,
    loading,
    error,
    refresh,
    setNodes,
    setEdges,
    patchNode,
    patchNodePositions,
    upsertNode,
    removeNode,
    upsertEdge,
    removeEdge,
  };
}
