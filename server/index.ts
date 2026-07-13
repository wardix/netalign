// server/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { buildEdgeId } from '../shared/edgeIds.ts';
import { getGatewayValidationError, normalizeGateway } from '../shared/edgeGateway.ts';
import { getPositionValidationError, parseNodePosition } from '../shared/nodePosition.ts';
import { validateEdgeBetweenNodes } from '../shared/edgeValidation.ts';
import type {
  BatchNodePositionsBody,
  CreateEdgeBody,
  CreateNodeBody,
  Topology,
  TopologyEdge,
  TopologyNode,
  TopologySummary,
  UpdateEdgeBody,
  UpdateNodeBody,
} from '../shared/types.ts';
import { parseTopologyImport } from '../shared/topologyImport.ts';
import { validateRouteId } from './paths.ts';
import * as topologyStore from './topologyStore.ts';
import type { Context } from 'hono';

const app = new Hono();

app.use('*', cors());

function invalidIdResponse(c: Context, id: string) {
  const validation = validateRouteId(id);
  if (!validation.ok) {
    return c.json({ error: validation.error }, 400);
  }
  return null;
}

function topologyIdOrResponse(c: Context, id: string) {
  const validation = validateRouteId(id);
  if (!validation.ok) {
    return { response: c.json({ error: validation.error }, 400) };
  }
  return { topologyId: id };
}

function topologyNotFound(c: Context) {
  return c.json({ error: 'Topology not found' }, 404);
}

// 1. Get all topologies
app.get('/api/topologies', async (c) => {
  try {
    return c.json(topologyStore.listTopologies());
  } catch (error) {
    console.error('Error reading topologies:', error);
    return c.json({ error: 'Failed to read topologies' }, 500);
  }
});

// 2. Get specific topology detail
app.get('/api/topologies/:id', async (c) => {
  const id = c.req.param('id');
  const idResult = topologyIdOrResponse(c, id);
  if ('response' in idResult) return idResult.response;

  try {
    const data = topologyStore.getTopology(idResult.topologyId);
    if (!data) return topologyNotFound(c);
    return c.json(data);
  } catch (error) {
    console.error('Error fetching topology:', error);
    return c.json({ error: 'Failed to read topology file' }, 500);
  }
});

// 3. Update a topology (rename)
app.patch('/api/topologies/:id', async (c) => {
  const id = c.req.param('id');
  const idResult = topologyIdOrResponse(c, id);
  if ('response' in idResult) return idResult.response;

  if (!topologyStore.topologyExists(idResult.topologyId)) {
    return topologyNotFound(c);
  }

  try {
    const body = await c.req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!name) {
      return c.json({ error: 'Name is required' }, 400);
    }

    const updated = topologyStore.renameTopology(idResult.topologyId, name);
    if (!updated) return topologyNotFound(c);
    return c.json(updated satisfies TopologySummary);
  } catch (error) {
    console.error('Error updating topology:', error);
    return c.json({ error: 'Failed to update topology' }, 500);
  }
});

// 4. Create a new topology
app.post('/api/topologies', async (c) => {
  try {
    const body = await c.req.json();
    const name = body.name || 'New Topology';
    const id = `topology-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const idValidation = validateRouteId(id);
    if (!idValidation.ok) {
      return c.json({ error: idValidation.error }, 400);
    }

    const newTopology: Topology = {
      id,
      name,
      nodes: [],
      edges: [],
    };

    topologyStore.createTopology(newTopology);
    return c.json(newTopology, 201);
  } catch (error) {
    console.error('Error creating topology:', error);
    return c.json({ error: 'Failed to create topology' }, 500);
  }
});

// 4b. Import a topology document as a new topology (never overwrites existing)
app.post('/api/topologies/import', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = parseTopologyImport(body);
    if (!parsed.ok) {
      return c.json({ error: parsed.error }, 400);
    }

    // Retry once if generated id collides (extremely unlikely).
    let topology = parsed.topology;
    if (topologyStore.topologyExists(topology.id)) {
      const retry = parseTopologyImport(body);
      if (!retry.ok) {
        return c.json({ error: retry.error }, 400);
      }
      topology = retry.topology;
      if (topologyStore.topologyExists(topology.id)) {
        return c.json({ error: 'Failed to allocate topology id' }, 500);
      }
    }

    topologyStore.createTopology(topology);
    return c.json(topology, 201);
  } catch (error) {
    console.error('Error importing topology:', error);
    return c.json({ error: 'Failed to import topology' }, 500);
  }
});

// 5. Delete a topology
app.post('/api/topologies/:id/delete', async (c) => {
  const id = c.req.param('id');
  const idResult = topologyIdOrResponse(c, id);
  if ('response' in idResult) return idResult.response;

  if (!topologyStore.topologyExists(idResult.topologyId)) {
    return topologyNotFound(c);
  }

  try {
    topologyStore.deleteTopology(idResult.topologyId);
    return c.json({ success: true, message: `Deleted topology ${id}` });
  } catch (error) {
    console.error('Error deleting topology:', error);
    return c.json({ error: 'Failed to delete topology file' }, 500);
  }
});

app.delete('/api/topologies/:id', async (c) => {
  const id = c.req.param('id');
  const idResult = topologyIdOrResponse(c, id);
  if ('response' in idResult) return idResult.response;

  if (!topologyStore.topologyExists(idResult.topologyId)) {
    return topologyNotFound(c);
  }

  try {
    topologyStore.deleteTopology(idResult.topologyId);
    return c.json({ success: true, message: `Deleted topology ${id}` });
  } catch (error) {
    console.error('Error deleting topology:', error);
    return c.json({ error: 'Failed to delete topology file' }, 500);
  }
});

// 6. Add a node to a topology
app.post('/api/topologies/:id/nodes', async (c) => {
  const id = c.req.param('id');
  const idResult = topologyIdOrResponse(c, id);
  if ('response' in idResult) return idResult.response;

  if (!topologyStore.topologyExists(idResult.topologyId)) {
    return topologyNotFound(c);
  }

  try {
    const body = (await c.req.json()) as CreateNodeBody;
    const { nodeId, type, label } = body;

    if (!nodeId || !type) {
      return c.json({ error: 'Missing nodeId or type' }, 400);
    }

    const invalidNodeId = invalidIdResponse(c, nodeId);
    if (invalidNodeId) return invalidNodeId;

    if (topologyStore.nodeExists(idResult.topologyId, nodeId)) {
      return c.json({ error: 'Node ID already exists' }, 400);
    }

    const newNode: TopologyNode = {
      id: nodeId,
      type,
      data: { label: label || nodeId },
    };

    topologyStore.addNode(idResult.topologyId, newNode);
    return c.json(newNode, 201);
  } catch (error) {
    console.error('Error adding node:', error);
    return c.json({ error: 'Failed to add node' }, 500);
  }
});

// 7a. Batch-update node positions (single transaction)
app.put('/api/topologies/:id/nodes/positions', async (c) => {
  const id = c.req.param('id');
  const idResult = topologyIdOrResponse(c, id);
  if ('response' in idResult) return idResult.response;

  if (!topologyStore.topologyExists(idResult.topologyId)) {
    return topologyNotFound(c);
  }

  try {
    const body = (await c.req.json()) as BatchNodePositionsBody;
    if (!body || !Array.isArray(body.updates)) {
      return c.json({ error: 'Body must include an updates array' }, 400);
    }

    const parsed: { nodeId: string; position: { x: number; y: number } }[] = [];
    for (const item of body.updates) {
      if (!item || typeof item !== 'object') {
        return c.json({ error: 'Each update must be an object with nodeId and position' }, 400);
      }
      const nodeId = typeof item.nodeId === 'string' ? item.nodeId : '';
      const invalidNode = invalidIdResponse(c, nodeId);
      if (invalidNode) return invalidNode;

      const positionError = getPositionValidationError(item.position);
      if (positionError) {
        return c.json({ error: positionError }, 400);
      }
      parsed.push({ nodeId, position: parseNodePosition(item.position)! });
    }

    const result = topologyStore.updateNodePositions(idResult.topologyId, parsed);
    if (!result.ok) {
      const status = result.error.startsWith('Node not found') ? 404 : 400;
      return c.json({ error: result.error }, status);
    }
    return c.json({ nodes: result.nodes });
  } catch (error) {
    console.error('Error batch-updating node positions:', error);
    return c.json({ error: 'Failed to update node positions' }, 500);
  }
});

// 7. Update a node in a topology
app.put('/api/topologies/:id/nodes/:nodeId', async (c) => {
  const id = c.req.param('id');
  const nodeId = c.req.param('nodeId');
  const invalidNode = invalidIdResponse(c, nodeId);
  if (invalidNode) return invalidNode;

  const idResult = topologyIdOrResponse(c, id);
  if ('response' in idResult) return idResult.response;

  if (!topologyStore.topologyExists(idResult.topologyId)) {
    return topologyNotFound(c);
  }

  try {
    const body = (await c.req.json()) as UpdateNodeBody;
    const labelProvided = Object.prototype.hasOwnProperty.call(body, 'label');
    const positionProvided = Object.prototype.hasOwnProperty.call(body, 'position');

    if (!labelProvided && !positionProvided) {
      return c.json({ error: 'Label or position is required' }, 400);
    }

    if (!topologyStore.nodeExists(idResult.topologyId, nodeId)) {
      return c.json({ error: 'Node not found' }, 404);
    }

    let node: TopologyNode | null = topologyStore.getNode(idResult.topologyId, nodeId);

    if (labelProvided) {
      const label = typeof body.label === 'string' ? body.label.trim() : '';
      if (!label) {
        return c.json({ error: 'Label is required' }, 400);
      }
      node = topologyStore.updateNodeLabel(idResult.topologyId, nodeId, label);
    }

    if (positionProvided) {
      const positionError = getPositionValidationError(body.position);
      if (positionError) {
        return c.json({ error: positionError }, 400);
      }
      const position = parseNodePosition(body.position)!;
      node = topologyStore.updateNodePosition(idResult.topologyId, nodeId, position);
    }

    if (!node) return c.json({ error: 'Node not found' }, 404);
    return c.json(node);
  } catch (error) {
    console.error('Error updating node:', error);
    return c.json({ error: 'Failed to update node' }, 500);
  }
});

// 8. Delete a node from a topology (and all connected edges)
app.delete('/api/topologies/:id/nodes/:nodeId', async (c) => {
  const id = c.req.param('id');
  const nodeId = c.req.param('nodeId');
  const invalidNode = invalidIdResponse(c, nodeId);
  if (invalidNode) return invalidNode;

  const idResult = topologyIdOrResponse(c, id);
  if ('response' in idResult) return idResult.response;

  if (!topologyStore.topologyExists(idResult.topologyId)) {
    return topologyNotFound(c);
  }

  try {
    const deleted = topologyStore.deleteNode(idResult.topologyId, nodeId);
    if (!deleted) {
      return c.json({ error: 'Node not found' }, 404);
    }

    return c.json({ success: true, message: `Node ${nodeId} deleted with connections` });
  } catch (error) {
    console.error('Error deleting node:', error);
    return c.json({ error: 'Failed to delete node' }, 500);
  }
});

// 9. Add an edge to a topology
app.post('/api/topologies/:id/edges', async (c) => {
  const id = c.req.param('id');
  const idResult = topologyIdOrResponse(c, id);
  if ('response' in idResult) return idResult.response;

  if (!topologyStore.topologyExists(idResult.topologyId)) {
    return topologyNotFound(c);
  }

  try {
    const body = (await c.req.json()) as CreateEdgeBody;
    const { source, target } = body;

    if (!source || !target) {
      return c.json({ error: 'Missing source or target' }, 400);
    }

    if (source === target) {
      return c.json({ error: 'Source and target must be different nodes' }, 400);
    }

    const sourceNode = topologyStore.getNode(idResult.topologyId, source);
    const targetNode = topologyStore.getNode(idResult.topologyId, target);

    if (!sourceNode || !targetNode) {
      return c.json({ error: 'Source or Target node does not exist' }, 400);
    }

    const topologyError = validateEdgeBetweenNodes(sourceNode, targetNode);
    if (topologyError) {
      return c.json({ error: topologyError }, 400);
    }

    const edgeId = buildEdgeId(source, target);

    if (topologyStore.edgeExists(idResult.topologyId, edgeId)) {
      return c.json({ error: 'Edge already exists between these nodes' }, 400);
    }

    const gateway = normalizeGateway(body.gateway);
    if (gateway) {
      const gatewayError = getGatewayValidationError(gateway);
      if (gatewayError) {
        return c.json({ error: gatewayError }, 400);
      }
    }

    const newEdge: TopologyEdge = {
      id: edgeId,
      source,
      target,
    };
    if (gateway) newEdge.gateway = gateway;

    topologyStore.addEdge(idResult.topologyId, newEdge);
    return c.json(newEdge, 201);
  } catch (error) {
    console.error('Error adding edge:', error);
    return c.json({ error: 'Failed to add edge' }, 500);
  }
});

// 10. Update an edge in a topology
app.put('/api/topologies/:id/edges/:edgeId', async (c) => {
  const id = c.req.param('id');
  const edgeId = c.req.param('edgeId');
  const invalidEdge = invalidIdResponse(c, edgeId);
  if (invalidEdge) return invalidEdge;

  const idResult = topologyIdOrResponse(c, id);
  if ('response' in idResult) return idResult.response;

  if (!topologyStore.topologyExists(idResult.topologyId)) {
    return topologyNotFound(c);
  }

  try {
    const body = (await c.req.json()) as UpdateEdgeBody;
    const gateway = normalizeGateway(body.gateway);
    if (gateway) {
      const gatewayError = getGatewayValidationError(gateway);
      if (gatewayError) {
        return c.json({ error: gatewayError }, 400);
      }
    }

    const edge = topologyStore.updateEdgeGateway(
      idResult.topologyId,
      edgeId,
      gateway ?? null,
    );

    if (!edge) {
      return c.json({ error: 'Edge not found' }, 404);
    }

    return c.json(edge);
  } catch (error) {
    console.error('Error updating edge:', error);
    return c.json({ error: 'Failed to update edge' }, 500);
  }
});

// 11. Delete an edge from a topology
app.delete('/api/topologies/:id/edges/:edgeId', async (c) => {
  const id = c.req.param('id');
  const edgeId = c.req.param('edgeId');
  const invalidEdge = invalidIdResponse(c, edgeId);
  if (invalidEdge) return invalidEdge;

  const idResult = topologyIdOrResponse(c, id);
  if ('response' in idResult) return idResult.response;

  if (!topologyStore.topologyExists(idResult.topologyId)) {
    return topologyNotFound(c);
  }

  try {
    const deleted = topologyStore.deleteEdge(idResult.topologyId, edgeId);
    if (!deleted) {
      return c.json({ error: 'Edge not found' }, 404);
    }

    return c.json({ success: true, message: `Edge ${edgeId} deleted` });
  } catch (error) {
    console.error('Error deleting edge:', error);
    return c.json({ error: 'Failed to delete edge' }, 500);
  }
});

const port = parseInt(Bun.env.PORT || process.env.PORT || '5000', 10);
console.log(`Hono backend is running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};