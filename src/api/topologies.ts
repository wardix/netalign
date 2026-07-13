import type { NodePosition } from '../../shared/nodePosition.ts';
import type {
  CreateEdgeBody,
  CreateNodeBody,
  Topology,
  TopologyEdge,
  TopologyNode,
  TopologySummary,
  UpdateEdgeBody,
  UpdateNodeBody,
} from '../../shared/types.ts';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './client.ts';

export interface DeleteSuccessResponse {
  success: boolean;
  message?: string;
}

export const topologyApi = {
  list(): Promise<TopologySummary[]> {
    return apiGet<TopologySummary[]>('/api/topologies');
  },

  get(id: string): Promise<Topology> {
    return apiGet<Topology>(`/api/topologies/${id}`);
  },

  create(name: string): Promise<Topology> {
    return apiPost<Topology>('/api/topologies', { name });
  },

  rename(id: string, name: string): Promise<TopologySummary> {
    return apiPatch<TopologySummary>(`/api/topologies/${id}`, { name });
  },

  delete(id: string): Promise<DeleteSuccessResponse> {
    return apiDelete<DeleteSuccessResponse>(`/api/topologies/${id}`);
  },

  addNode(topologyId: string, body: CreateNodeBody): Promise<TopologyNode> {
    return apiPost<TopologyNode>(`/api/topologies/${topologyId}/nodes`, body);
  },

  updateNode(topologyId: string, nodeId: string, body: UpdateNodeBody): Promise<TopologyNode> {
    return apiPut<TopologyNode>(`/api/topologies/${topologyId}/nodes/${nodeId}`, body);
  },

  updateNodePosition(
    topologyId: string,
    nodeId: string,
    position: NodePosition,
  ): Promise<TopologyNode> {
    return apiPut<TopologyNode>(`/api/topologies/${topologyId}/nodes/${nodeId}`, { position });
  },

  deleteNode(topologyId: string, nodeId: string): Promise<DeleteSuccessResponse> {
    return apiDelete<DeleteSuccessResponse>(`/api/topologies/${topologyId}/nodes/${nodeId}`);
  },

  addEdge(topologyId: string, body: CreateEdgeBody): Promise<TopologyEdge> {
    return apiPost<TopologyEdge>(`/api/topologies/${topologyId}/edges`, body);
  },

  updateEdge(topologyId: string, edgeId: string, body: UpdateEdgeBody): Promise<TopologyEdge> {
    return apiPut<TopologyEdge>(`/api/topologies/${topologyId}/edges/${edgeId}`, body);
  },

  deleteEdge(topologyId: string, edgeId: string): Promise<DeleteSuccessResponse> {
    return apiDelete<DeleteSuccessResponse>(`/api/topologies/${topologyId}/edges/${edgeId}`);
  },
};