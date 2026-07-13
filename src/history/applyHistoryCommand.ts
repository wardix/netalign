import { topologyApi } from '../api/topologies.ts';
import type { HistoryCommand } from './historyStack.ts';

/** Apply the inverse of a command (undo). */
export async function applyUndoCommand(command: HistoryCommand): Promise<void> {
  switch (command.type) {
    case 'addNode':
      await topologyApi.deleteNode(command.topologyId, command.node.id);
      return;
    case 'deleteNode': {
      const label = command.node.data?.label || command.node.id;
      await topologyApi.addNode(command.topologyId, {
        nodeId: command.node.id,
        type: command.node.type,
        label,
      });
      if (command.node.position) {
        await topologyApi.updateNodePosition(
          command.topologyId,
          command.node.id,
          command.node.position,
        );
      }
      for (const edge of command.connectedEdges) {
        const body: { source: string; target: string; gateway?: string } = {
          source: edge.source,
          target: edge.target,
        };
        if (edge.gateway) body.gateway = edge.gateway;
        await topologyApi.addEdge(command.topologyId, body);
      }
      return;
    }
    case 'addEdge':
      await topologyApi.deleteEdge(command.topologyId, command.edge.id);
      return;
    case 'deleteEdge': {
      const body: { source: string; target: string; gateway?: string } = {
        source: command.edge.source,
        target: command.edge.target,
      };
      if (command.edge.gateway) body.gateway = command.edge.gateway;
      await topologyApi.addEdge(command.topologyId, body);
      return;
    }
    case 'updateNodeLabel':
      await topologyApi.updateNode(command.topologyId, command.nodeId, {
        label: command.previousLabel,
      });
      return;
    case 'updateEdgeGateway':
      await topologyApi.updateEdge(command.topologyId, command.edgeId, {
        gateway: command.previousGateway,
      });
      return;
    case 'moveNodes':
      await topologyApi.updateNodePositions(command.topologyId, command.previous);
      return;
  }
}

/** Re-apply a command (redo). */
export async function applyRedoCommand(command: HistoryCommand): Promise<void> {
  switch (command.type) {
    case 'addNode': {
      await topologyApi.addNode(command.topologyId, {
        nodeId: command.node.id,
        type: command.node.type,
        label: command.node.label,
      });
      if (command.node.position) {
        await topologyApi.updateNodePosition(
          command.topologyId,
          command.node.id,
          command.node.position,
        );
      }
      return;
    }
    case 'deleteNode':
      await topologyApi.deleteNode(command.topologyId, command.node.id);
      return;
    case 'addEdge': {
      const body: { source: string; target: string; gateway?: string } = {
        source: command.edge.source,
        target: command.edge.target,
      };
      if (command.edge.gateway) body.gateway = command.edge.gateway;
      await topologyApi.addEdge(command.topologyId, body);
      return;
    }
    case 'deleteEdge':
      await topologyApi.deleteEdge(command.topologyId, command.edge.id);
      return;
    case 'updateNodeLabel':
      await topologyApi.updateNode(command.topologyId, command.nodeId, {
        label: command.nextLabel,
      });
      return;
    case 'updateEdgeGateway':
      await topologyApi.updateEdge(command.topologyId, command.edgeId, {
        gateway: command.nextGateway,
      });
      return;
    case 'moveNodes':
      await topologyApi.updateNodePositions(command.topologyId, command.next);
      return;
  }
}
