import { useCallback, useEffect, useState } from 'react';
import { getApiErrorMessage } from '../api/client.ts';
import { topologyApi } from '../api/topologies.ts';
import type { TopologyEdge, TopologyNode } from '../../shared/types.ts';

interface UseTopologyResult {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useTopology(
  topologyId: string | null,
  refreshKey: number,
  loadFailedMessage: string,
): UseTopologyResult {
  const [nodes, setNodes] = useState<TopologyNode[]>([]);
  const [edges, setEdges] = useState<TopologyEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!topologyId) {
      setNodes([]);
      setEdges([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await topologyApi.get(topologyId);
      setNodes(data.nodes ?? []);
      setEdges(data.edges ?? []);
    } catch (err) {
      console.error('Failed to load topology detail', err);
      setNodes([]);
      setEdges([]);
      setError(getApiErrorMessage(err, loadFailedMessage));
    } finally {
      setLoading(false);
    }
  }, [topologyId, loadFailedMessage]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  return { nodes, edges, loading, error, refresh };
}