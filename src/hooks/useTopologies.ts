import { useCallback, useEffect, useState } from 'react';
import { getApiErrorMessage } from '../api/client.ts';
import { topologyApi } from '../api/topologies.ts';
import type { TopologySummary } from '../../shared/types.ts';

interface UseTopologiesResult {
  topologies: TopologySummary[];
  loading: boolean;
  error: string | null;
  refresh: (selectId?: string) => Promise<TopologySummary[]>;
}

export function useTopologies(loadFailedMessage: string): UseTopologiesResult {
  const [topologies, setTopologies] = useState<TopologySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (_selectId?: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await topologyApi.list();
        setTopologies(data);
        return data;
      } catch (err) {
        console.error(err);
        setError(getApiErrorMessage(err, loadFailedMessage));
        setTopologies([]);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [loadFailedMessage],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { topologies, loading, error, refresh };
}