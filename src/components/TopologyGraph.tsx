// src/components/TopologyGraph.tsx
import React, { useEffect, useState, useRef } from 'react';
import { Alert, Button, Empty, Spin } from 'antd';
import CytoscapeComponent from 'react-cytoscapejs';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { computeLayout, getConnectedPeerIds } from '../../shared/layoutEngine.ts';
import type { NodePosition } from '../../shared/nodePosition.ts';
import type { TopologyNode } from '../../shared/topologyNodes.ts';
import type { TopologyEdge } from '../../shared/types.ts';
import { EmptyTopologyGuide } from './EmptyTopologyGuide.tsx';

interface NodePositionUpdate {
  nodeId: string;
  position: NodePosition;
}

interface TopologyGraphProps {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  loading?: boolean;
  error?: string | null;
  hasTopology?: boolean;
  onRetry?: () => void;
  onNodeSelect?: (nodeId: string) => void;
  onEdgeSelect?: (edgeId: string) => void;
  onNodePositionsChange?: (
    updates: NodePositionUpdate[],
    previous: NodePositionUpdate[],
  ) => void;
  onResetLayout?: () => void;
  onScaffoldSample?: () => void | Promise<void>;
  scaffolding?: boolean;
}

const canvasOverlayStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  padding: 24,
  color: '#9ca3af',
};

const TopologyGraph: React.FC<TopologyGraphProps> = ({
  nodes,
  edges,
  loading = false,
  error = null,
  hasTopology = true,
  onRetry,
  onNodeSelect,
  onEdgeSelect,
  onNodePositionsChange,
  onResetLayout,
  onScaffoldSample,
  scaffolding = false,
}) => {
  const { t } = useI18n();
  const [elements, setElements] = useState<any[]>([]);
  const [styles, setStyles] = useState<any[]>([]);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const cyRef = useRef<any>(null);
  const dragStateRef = useRef<{
    nodeId: string;
    startPositions: Record<string, NodePosition>;
  } | null>(null);

  useEffect(() => {
    try {
      const { elements: cyElements, styles: cyStyles } = computeLayout(nodes, edges);
      setElements(cyElements);
      setStyles(cyStyles);
      setLayoutError(null);
    } catch (err) {
      console.error('Layout compute failed', err);
      setElements([]);
      setStyles([]);
      setLayoutError(t('canvas.crashDetail'));
    }
  }, [nodes, edges, t]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    const refreshStylesFromCy = () => {
      const livePositions: Record<string, NodePosition> = {};
      cy.nodes().forEach((node: any) => {
        livePositions[node.id()] = node.position();
      });
      try {
        const { styles: nextStyles } = computeLayout(nodes, edges, livePositions);
        cy.style(nextStyles);
        setLayoutError(null);
      } catch (err) {
        console.error('Layout style refresh failed', err);
        setLayoutError(t('canvas.crashDetail'));
      }
    };

    const onNodeTap = (evt: any) => {
      const id = evt.target.id();
      if (onNodeSelect) onNodeSelect(id);
    };
    const onEdgeTap = (evt: any) => {
      const id = evt.target.id();
      if (onEdgeSelect) onEdgeSelect(id);
    };
    const onGrab = (evt: any) => {
      const node = evt.target;
      const nodeId = node.id();
      const nodeData = nodes.find(n => n.id === nodeId);
      if (!nodeData) return;

      const startPositions: Record<string, NodePosition> = {
        [nodeId]: { ...node.position() },
      };

      if (nodeData.type === 'subnet') {
        getConnectedPeerIds(nodeId, nodeData.type, edges, nodes).forEach(peerId => {
          const peer = cy.getElementById(peerId);
          if (peer.nonempty()) {
            startPositions[peerId] = { ...peer.position() };
          }
        });
      }

      dragStateRef.current = { nodeId, startPositions };
    };
    const onDrag = (evt: any) => {
      const state = dragStateRef.current;
      if (!state) return;

      const node = evt.target;
      const nodeId = node.id();
      const nodeData = nodes.find(n => n.id === nodeId);
      if (!nodeData || nodeId !== state.nodeId) return;

      if (nodeData.type === 'subnet') {
        const current = node.position();
        const start = state.startPositions[nodeId];
        const delta = { x: current.x - start.x, y: current.y - start.y };

        getConnectedPeerIds(nodeId, nodeData.type, edges, nodes).forEach(peerId => {
          const peerStart = state.startPositions[peerId];
          if (!peerStart) return;
          cy.getElementById(peerId).position({
            x: peerStart.x + delta.x,
            y: peerStart.y + delta.y,
          });
        });
      }

      refreshStylesFromCy();
    };
    const onDragFree = () => {
      const state = dragStateRef.current;
      dragStateRef.current = null;
      if (!state || !onNodePositionsChange) return;

      const movedIds = new Set<string>([state.nodeId]);
      const nodeData = nodes.find(n => n.id === state.nodeId);
      if (nodeData?.type === 'subnet') {
        getConnectedPeerIds(state.nodeId, nodeData.type, edges, nodes).forEach(id => movedIds.add(id));
      }

      const updates = [...movedIds].map(id => ({
        nodeId: id,
        position: cy.getElementById(id).position(),
      }));
      const previous = [...movedIds].map(id => ({
        nodeId: id,
        position: { ...state.startPositions[id]! },
      }));

      onNodePositionsChange(updates, previous);
    };

    cy.nodes().grabify();
    cy.on('tap', 'node', onNodeTap);
    cy.on('tap', 'edge', onEdgeTap);
    cy.on('grab', 'node', onGrab);
    cy.on('drag', 'node', onDrag);
    cy.on('dragfree', 'node', onDragFree);

    return () => {
      cy.removeListener('tap', 'node', onNodeTap);
      cy.removeListener('tap', 'edge', onEdgeTap);
      cy.removeListener('grab', 'node', onGrab);
      cy.removeListener('drag', 'node', onDrag);
      cy.removeListener('dragfree', 'node', onDragFree);
    };
  }, [elements, nodes, edges, onNodeSelect, onEdgeSelect, onNodePositionsChange]);

  const handleZoomIn = () => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() * 1.2);
    }
  };

  const handleZoomOut = () => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() / 1.2);
    }
  };

  const handleFit = () => {
    if (cyRef.current) {
      cyRef.current.fit();
      cyRef.current.center();
    }
  };

  const displayError = error || layoutError;

  if (displayError) {
    return (
      <div style={canvasOverlayStyle}>
        <Alert
          type="error"
          showIcon
          message={layoutError && !error ? t('canvas.crashTitle') : t('canvas.loadFailed')}
          description={displayError}
          action={
            onRetry ? (
              <Button
                size="small"
                onClick={() => {
                  setLayoutError(null);
                  onRetry();
                }}
              >
                {t('common.retry')}
              </Button>
            ) : undefined
          }
          style={{ maxWidth: 420 }}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div style={canvasOverlayStyle}>
        <Spin size="large" tip={t('canvas.loading')} />
      </div>
    );
  }

  if (!hasTopology) {
    return (
      <div style={canvasOverlayStyle}>
        <Empty description={t('canvas.selectTopology')} />
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <EmptyTopologyGuide onScaffoldSample={onScaffoldSample} scaffolding={scaffolding} />
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <CytoscapeComponent
        elements={elements}
        style={{ width: '100%', height: '100%' }}
        stylesheet={styles}
        layout={{ name: 'preset' }}
        cy={cy => {
          cyRef.current = cy;
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          zIndex: 1000,
          background: 'rgba(255, 255, 255, 0.8)',
          padding: '6px 10px',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(0, 0, 0, 0.06)',
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleZoomIn}
            style={{
              width: 32,
              height: 32,
              borderRadius: 4,
              border: '1px solid #d9d9d9',
              background: '#fff',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 0 rgba(0,0,0,0.015)',
            }}
            title={t('canvas.zoomIn')}
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            style={{
              width: 32,
              height: 32,
              borderRadius: 4,
              border: '1px solid #d9d9d9',
              background: '#fff',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 0 rgba(0,0,0,0.015)',
            }}
            title={t('canvas.zoomOut')}
          >
            -
          </button>
          <button
            onClick={handleFit}
            style={{
              padding: '0 10px',
              height: 32,
              borderRadius: 4,
              border: '1px solid #d9d9d9',
              background: '#fff',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 0 rgba(0,0,0,0.015)',
            }}
            title={t('canvas.fit')}
          >
            {t('canvas.fit')}
          </button>
          {onResetLayout && (
            <button
              onClick={onResetLayout}
              style={{
                padding: '0 10px',
                height: 32,
                borderRadius: 4,
                border: '1px solid #d9d9d9',
                background: '#fff',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 0 rgba(0,0,0,0.015)',
              }}
              title={t('canvas.resetLayout')}
            >
              {t('canvas.resetLayout')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopologyGraph;