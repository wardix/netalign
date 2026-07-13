import { useCallback, useEffect, useState } from 'react';
import type { TopologyEdge, TopologyNode } from '../../shared/types.ts';

export interface SelectedNodeData {
  id: string;
  label: string;
  type: string;
}

function toSelectedNodeData(node: TopologyNode): SelectedNodeData {
  return {
    id: node.id,
    label: node.data?.label || node.id,
    type: node.type,
  };
}

export interface UseSelectionResult {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedNodeData: SelectedNodeData | null;
  selectedEdgeData: TopologyEdge | null;
  selectNode: (nodeId: string) => void;
  selectEdge: (edgeId: string) => void;
  clearNodeSelection: () => void;
  clearEdgeSelection: () => void;
  setSelectedNodeData: (data: SelectedNodeData | null) => void;
  setSelectedEdgeData: (data: TopologyEdge | null) => void;
}

/**
 * Graph selection state, kept in sync with the active topology's nodes/edges.
 */
export function useSelection(
  activeTopologyId: string | null,
  nodes: TopologyNode[],
  edges: TopologyEdge[],
): UseSelectionResult {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedNodeData, setSelectedNodeData] = useState<SelectedNodeData | null>(null);
  const [selectedEdgeData, setSelectedEdgeData] = useState<TopologyEdge | null>(null);

  useEffect(() => {
    setSelectedNodeId(null);
    setSelectedNodeData(null);
    setSelectedEdgeId(null);
    setSelectedEdgeData(null);
  }, [activeTopologyId]);

  useEffect(() => {
    if (!selectedNodeId) return;
    const node = nodes.find(n => n.id === selectedNodeId);
    if (!node) {
      setSelectedNodeId(null);
      setSelectedNodeData(null);
      return;
    }
    setSelectedNodeData(toSelectedNodeData(node));
  }, [nodes, selectedNodeId]);

  useEffect(() => {
    if (!selectedEdgeId) return;
    const edge = edges.find(e => e.id === selectedEdgeId);
    if (!edge) {
      setSelectedEdgeId(null);
      setSelectedEdgeData(null);
      return;
    }
    setSelectedEdgeData(edge);
  }, [edges, selectedEdgeId]);

  const selectNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;

      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
      setSelectedEdgeData(null);
      setSelectedNodeData(toSelectedNodeData(node));
    },
    [nodes],
  );

  const selectEdge = useCallback(
    (edgeId: string) => {
      const edge = edges.find(e => e.id === edgeId);
      if (!edge) return;

      setSelectedEdgeId(edgeId);
      setSelectedNodeId(null);
      setSelectedNodeData(null);
      setSelectedEdgeData(edge);
    },
    [edges],
  );

  const clearNodeSelection = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedNodeData(null);
  }, []);

  const clearEdgeSelection = useCallback(() => {
    setSelectedEdgeId(null);
    setSelectedEdgeData(null);
  }, []);

  return {
    selectedNodeId,
    selectedEdgeId,
    selectedNodeData,
    selectedEdgeData,
    selectNode,
    selectEdge,
    clearNodeSelection,
    clearEdgeSelection,
    setSelectedNodeData,
    setSelectedEdgeData,
  };
}
