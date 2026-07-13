// server/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { readdir, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { buildEdgeId } from '../shared/edgeIds.ts';
import { getGatewayValidationError, normalizeGateway } from '../shared/edgeGateway.ts';
import { validateEdgeBetweenNodes } from '../shared/edgeValidation.ts';
import { resolveTopologyFilePath, validateRouteId } from './paths.ts';
import type { Context } from 'hono';

const app = new Hono();

// Enable CORS for all routes (to support both proxy and direct requests)
app.use('*', cors());

const DATA_DIR = resolve(import.meta.dir, 'data');

function invalidIdResponse(c: Context, id: string) {
  const validation = validateRouteId(id);
  if (!validation.ok) {
    return c.json({ error: validation.error }, 400);
  }
  return null;
}

function topologyPathOrResponse(c: Context, id: string) {
  const pathResult = resolveTopologyFilePath(id);
  if (!pathResult.ok) {
    return { response: c.json({ error: pathResult.error }, 400) };
  }
  return { filePath: pathResult.filePath };
}

// --- API ROUTES ---

// 1. Get all topologies
app.get('/api/topologies', async (c) => {
  try {
    const files = await readdir(DATA_DIR);
    const topologies = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = join(DATA_DIR, file);
        const fileContent = await Bun.file(filePath).json();
        topologies.push({
          id: fileContent.id,
          name: fileContent.name || fileContent.id
        });
      }
    }

    return c.json(topologies);
  } catch (error) {
    console.error('Error reading topologies:', error);
    return c.json({ error: 'Failed to read topologies' }, 500);
  }
});

// 2. Get specific topology detail
app.get('/api/topologies/:id', async (c) => {
  const id = c.req.param('id');
  const pathResult = topologyPathOrResponse(c, id);
  if ('response' in pathResult) return pathResult.response;
  const { filePath } = pathResult;

  if (!(await Bun.file(filePath).exists())) {
    return c.json({ error: 'Topology not found' }, 404);
  }

  try {
    const data = await Bun.file(filePath).json();
    return c.json(data);
  } catch (error) {
    console.error('Error fetching topology:', error);
    return c.json({ error: 'Failed to read topology file' }, 500);
  }
});

// 3. Update a topology (rename)
app.patch('/api/topologies/:id', async (c) => {
  const id = c.req.param('id');
  const pathResult = topologyPathOrResponse(c, id);
  if ('response' in pathResult) return pathResult.response;
  const { filePath } = pathResult;

  if (!(await Bun.file(filePath).exists())) {
    return c.json({ error: 'Topology not found' }, 404);
  }

  try {
    const body = await c.req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!name) {
      return c.json({ error: 'Name is required' }, 400);
    }

    const data = await Bun.file(filePath).json();
    data.name = name;

    await Bun.write(filePath, JSON.stringify(data, null, 2));
    return c.json({ id: data.id, name: data.name });
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
    const id = `topology-${Date.now()}`;
    const pathResult = resolveTopologyFilePath(id);
    if (!pathResult.ok) {
      return c.json({ error: pathResult.error }, 400);
    }
    const { filePath } = pathResult;

    const newTopology = {
      id,
      name,
      nodes: [],
      edges: []
    };

    await Bun.write(filePath, JSON.stringify(newTopology, null, 2));
    return c.json(newTopology, 201);
  } catch (error) {
    console.error('Error creating topology:', error);
    return c.json({ error: 'Failed to create topology' }, 500);
  }
});

// 5. Delete a topology
app.post('/api/topologies/:id/delete', async (c) => {
  // Use POST for delete from some clients, but we also support DELETE
  const id = c.req.param('id');
  const pathResult = topologyPathOrResponse(c, id);
  if ('response' in pathResult) return pathResult.response;
  const { filePath } = pathResult;

  if (!(await Bun.file(filePath).exists())) {
    return c.json({ error: 'Topology not found' }, 404);
  }

  try {
    await unlink(filePath);
    return c.json({ success: true, message: `Deleted topology ${id}` });
  } catch (error) {
    console.error('Error deleting topology:', error);
    return c.json({ error: 'Failed to delete topology file' }, 500);
  }
});

// Also support native DELETE verb
app.delete('/api/topologies/:id', async (c) => {
  const id = c.req.param('id');
  const pathResult = topologyPathOrResponse(c, id);
  if ('response' in pathResult) return pathResult.response;
  const { filePath } = pathResult;

  if (!(await Bun.file(filePath).exists())) {
    return c.json({ error: 'Topology not found' }, 404);
  }

  try {
    await unlink(filePath);
    return c.json({ success: true, message: `Deleted topology ${id}` });
  } catch (error) {
    console.error('Error deleting topology:', error);
    return c.json({ error: 'Failed to delete topology file' }, 500);
  }
});

// 6. Add a node to a topology
app.post('/api/topologies/:id/nodes', async (c) => {
  const id = c.req.param('id');
  const pathResult = topologyPathOrResponse(c, id);
  if ('response' in pathResult) return pathResult.response;
  const { filePath } = pathResult;

  if (!(await Bun.file(filePath).exists())) {
    return c.json({ error: 'Topology not found' }, 404);
  }

  try {
    const body = await c.req.json();
    const { nodeId, type, label } = body;

    if (!nodeId || !type) {
      return c.json({ error: 'Missing nodeId or type' }, 400);
    }

    const invalidNodeId = invalidIdResponse(c, nodeId);
    if (invalidNodeId) return invalidNodeId;

    const data = await Bun.file(filePath).json();

    // Check duplicate node ID
    if (data.nodes.some((n: any) => n.id === nodeId)) {
      return c.json({ error: 'Node ID already exists' }, 400);
    }

    const newNode = {
      id: nodeId,
      type,
      data: { label: label || nodeId }
    };

    data.nodes.push(newNode);

    await Bun.write(filePath, JSON.stringify(data, null, 2));
    return c.json(newNode, 201);
  } catch (error) {
    console.error('Error adding node:', error);
    return c.json({ error: 'Failed to add node' }, 500);
  }
});

// 7. Update a node in a topology
app.put('/api/topologies/:id/nodes/:nodeId', async (c) => {
  const id = c.req.param('id');
  const nodeId = c.req.param('nodeId');
  const invalidNode = invalidIdResponse(c, nodeId);
  if (invalidNode) return invalidNode;

  const pathResult = topologyPathOrResponse(c, id);
  if ('response' in pathResult) return pathResult.response;
  const { filePath } = pathResult;

  if (!(await Bun.file(filePath).exists())) {
    return c.json({ error: 'Topology not found' }, 404);
  }

  try {
    const body = await c.req.json();
    const label = typeof body.label === 'string' ? body.label.trim() : '';

    if (!label) {
      return c.json({ error: 'Label is required' }, 400);
    }

    const data = await Bun.file(filePath).json();
    const node = data.nodes.find((n: { id: string }) => n.id === nodeId);

    if (!node) {
      return c.json({ error: 'Node not found' }, 404);
    }

    node.data = { ...node.data, label };

    await Bun.write(filePath, JSON.stringify(data, null, 2));
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

  const pathResult = topologyPathOrResponse(c, id);
  if ('response' in pathResult) return pathResult.response;
  const { filePath } = pathResult;

  if (!(await Bun.file(filePath).exists())) {
    return c.json({ error: 'Topology not found' }, 404);
  }

  try {
    const data = await Bun.file(filePath).json();

    const initialNodeCount = data.nodes.length;
    data.nodes = data.nodes.filter((n: any) => n.id !== nodeId);

    if (data.nodes.length === initialNodeCount) {
      return c.json({ error: 'Node not found' }, 404);
    }

    // Cascade delete connected edges
    data.edges = data.edges.filter((e: any) => e.source !== nodeId && e.target !== nodeId);

    await Bun.write(filePath, JSON.stringify(data, null, 2));
    return c.json({ success: true, message: `Node ${nodeId} deleted with connections` });
  } catch (error) {
    console.error('Error deleting node:', error);
    return c.json({ error: 'Failed to delete node' }, 500);
  }
});

// 9. Add an edge to a topology
app.post('/api/topologies/:id/edges', async (c) => {
  const id = c.req.param('id');
  const pathResult = topologyPathOrResponse(c, id);
  if ('response' in pathResult) return pathResult.response;
  const { filePath } = pathResult;

  if (!(await Bun.file(filePath).exists())) {
    return c.json({ error: 'Topology not found' }, 404);
  }

  try {
    const body = await c.req.json();
    const { source, target } = body;

    if (!source || !target) {
      return c.json({ error: 'Missing source or target' }, 400);
    }

    if (source === target) {
      return c.json({ error: 'Source and target must be different nodes' }, 400);
    }

    const data = await Bun.file(filePath).json();

    const sourceNode = data.nodes.find((n: { id: string }) => n.id === source);
    const targetNode = data.nodes.find((n: { id: string }) => n.id === target);

    if (!sourceNode || !targetNode) {
      return c.json({ error: 'Source or Target node does not exist' }, 400);
    }

    const topologyError = validateEdgeBetweenNodes(sourceNode, targetNode);
    if (topologyError) {
      return c.json({ error: topologyError }, 400);
    }

    const edgeId = buildEdgeId(source, target);

    // Check duplicate edge ID
    if (data.edges.some((e: any) => e.id === edgeId)) {
      return c.json({ error: 'Edge already exists between these nodes' }, 400);
    }

    const gateway = normalizeGateway(body.gateway);
    if (gateway) {
      const gatewayError = getGatewayValidationError(gateway);
      if (gatewayError) {
        return c.json({ error: gatewayError }, 400);
      }
    }

    const newEdge: { id: string; source: string; target: string; gateway?: string } = {
      id: edgeId,
      source,
      target,
    };
    if (gateway) newEdge.gateway = gateway;

    data.edges.push(newEdge);

    await Bun.write(filePath, JSON.stringify(data, null, 2));
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

  const pathResult = topologyPathOrResponse(c, id);
  if ('response' in pathResult) return pathResult.response;
  const { filePath } = pathResult;

  if (!(await Bun.file(filePath).exists())) {
    return c.json({ error: 'Topology not found' }, 404);
  }

  try {
    const body = await c.req.json();
    const gateway = normalizeGateway(body.gateway);
    if (gateway) {
      const gatewayError = getGatewayValidationError(gateway);
      if (gatewayError) {
        return c.json({ error: gatewayError }, 400);
      }
    }

    const data = await Bun.file(filePath).json();
    const edge = data.edges.find((e: { id: string }) => e.id === edgeId);

    if (!edge) {
      return c.json({ error: 'Edge not found' }, 404);
    }

    if (gateway) {
      edge.gateway = gateway;
    } else {
      delete edge.gateway;
    }

    await Bun.write(filePath, JSON.stringify(data, null, 2));
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

  const pathResult = topologyPathOrResponse(c, id);
  if ('response' in pathResult) return pathResult.response;
  const { filePath } = pathResult;

  if (!(await Bun.file(filePath).exists())) {
    return c.json({ error: 'Topology not found' }, 404);
  }

  try {
    const data = await Bun.file(filePath).json();

    const initialEdgeCount = data.edges.length;
    data.edges = data.edges.filter((e: any) => e.id !== edgeId);

    if (data.edges.length === initialEdgeCount) {
      return c.json({ error: 'Edge not found' }, 404);
    }

    await Bun.write(filePath, JSON.stringify(data, null, 2));
    return c.json({ success: true, message: `Edge ${edgeId} deleted` });
  } catch (error) {
    console.error('Error deleting edge:', error);
    return c.json({ error: 'Failed to delete edge' }, 500);
  }
});

// Start the server running via Bun on a custom port from environment variables, falling back to 5000
const port = parseInt(Bun.env.PORT || process.env.PORT || '5000', 10);
console.log(`Hono backend is running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch
};
