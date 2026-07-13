// src/components/TopologyGraph.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AutoComplete, Button, Empty, Input, Spin } from 'antd';
import type {
  Core,
  EventObject,
  EventObjectNode,
  NodeSingular,
  StylesheetStyle,
} from 'cytoscape';
import CytoscapeComponent from 'react-cytoscapejs';
import { useI18n } from '../i18n/I18nProvider.tsx';
import {
  computeLayout,
  getConnectedPeerIds,
  type CytoscapeElement,
  type CytoscapeStyle,
} from '../../shared/layoutEngine.ts';
import type { NodePosition } from '../../shared/nodePosition.ts';
import { getNodeLabel, type TopologyNode } from '../../shared/topologyNodes.ts';
import type { TopologyEdge } from '../../shared/types.ts';
import { searchTopologyNodes } from '../../shared/nodeSearch.ts';
import { EmptyTopologyGuide } from './EmptyTopologyGuide.tsx';

interface NodePositionUpdate {
  nodeId: string;
  position: NodePosition;
}

type PositionedNodeElement = CytoscapeElement & {
  position: NodePosition;
  data: Record<string, unknown> & { id: string };
};

function isPositionedNodeElement(el: CytoscapeElement): el is PositionedNodeElement {
  return (
    el.position != null &&
    typeof el.data.id === 'string' &&
    el.data.source === undefined
  );
}

function toStylesheet(styles: CytoscapeStyle[]): StylesheetStyle[] {
  // Layout engine styles match Cytoscape stylesheet JSON shape (selector + style map).
  return styles as StylesheetStyle[];
}

interface TopologyGraphProps {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  loading?: boolean;
  error?: string | null;
  hasTopology?: boolean;
  selectedNodeId?: string | null;
  selectedEdgeId?: string | null;
  onRetry?: () => void;
  onNodeSelect?: (nodeId: string) => void;
  onEdgeSelect?: (edgeId: string) => void;
  onDeselect?: () => void;
  onDeleteSelection?: () => void;
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

const chromeButtonStyle: React.CSSProperties = {
  minWidth: 40,
  minHeight: 40,
  padding: '0 10px',
  borderRadius: 4,
  border: '1px solid #9ca3af',
  background: '#fff',
  color: '#111827',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 2px 0 rgba(0,0,0,0.06)',
};

const TopologyGraph: React.FC<TopologyGraphProps> = ({
  nodes,
  edges,
  loading = false,
  error = null,
  hasTopology = true,
  selectedNodeId = null,
  selectedEdgeId = null,
  onRetry,
  onNodeSelect,
  onEdgeSelect,
  onDeselect,
  onDeleteSelection,
  onNodePositionsChange,
  onResetLayout,
  onScaffoldSample,
  scaffolding = false,
}) => {
  const { t } = useI18n();
  const [elements, setElements] = useState<CytoscapeElement[]>([]);
  const [styles, setStyles] = useState<CytoscapeStyle[]>([]);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const cyRef = useRef<Core | null>(null);
  const dragStateRef = useRef<{
    nodeId: string;
    startPositions: Record<string, NodePosition>;
  } | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const focusNode = useCallback(
    (nodeId: string) => {
      const cy = cyRef.current;
      if (!cy) return;
      const el = cy.getElementById(nodeId);
      if (!el || el.empty()) return;

      cy.nodes().removeClass('search-hit');
      cy.edges().unselect();
      cy.nodes().unselect();
      el.addClass('search-hit');
      el.select();
      cy.animate({
        fit: { eles: el, padding: 100 },
        duration: 280,
      });
      onNodeSelect?.(nodeId);

      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => {
        cy.nodes().removeClass('search-hit');
      }, 2500);
    },
    [onNodeSelect],
  );

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    const refreshStylesFromCy = () => {
      const livePositions: Record<string, NodePosition> = {};
      cy.nodes().forEach((node: NodeSingular) => {
        const pos = node.position();
        livePositions[node.id()] = { x: pos.x, y: pos.y };
      });
      try {
        const { styles: nextStyles } = computeLayout(nodes, edges, livePositions);
        cy.style().fromJson(toStylesheet(nextStyles)).update();
        setLayoutError(null);
      } catch (err) {
        console.error('Layout style refresh failed', err);
        setLayoutError(t('canvas.crashDetail'));
      }
    };

    const onNodeTap = (evt: EventObjectNode) => {
      const id = evt.target.id();
      cy.nodes().removeClass('search-hit');
      if (onNodeSelect) onNodeSelect(id);
    };
    const onEdgeTap = (evt: EventObject) => {
      const id = evt.target.id();
      cy.nodes().removeClass('search-hit');
      if (onEdgeSelect) onEdgeSelect(id);
    };
    const onBackgroundTap = (evt: EventObject) => {
      if (evt.target === cy) {
        cy.nodes().removeClass('search-hit');
        cy.elements().unselect();
        onDeselect?.();
      }
    };
    const onGrab = (evt: EventObjectNode) => {
      const node = evt.target;
      const nodeId = node.id();
      const nodeData = nodes.find(n => n.id === nodeId);
      if (!nodeData) return;

      const pos = node.position();
      const startPositions: Record<string, NodePosition> = {
        [nodeId]: { x: pos.x, y: pos.y },
      };

      if (nodeData.type === 'subnet') {
        getConnectedPeerIds(nodeId, nodeData.type, edges, nodes).forEach(peerId => {
          const peer = cy.getElementById(peerId);
          if (peer.nonempty()) {
            const peerPos = peer.position();
            startPositions[peerId] = { x: peerPos.x, y: peerPos.y };
          }
        });
      }

      dragStateRef.current = { nodeId, startPositions };
    };
    const onDrag = (evt: EventObjectNode) => {
      const state = dragStateRef.current;
      if (!state) return;

      const node = evt.target;
      const nodeId = node.id();
      const nodeData = nodes.find(n => n.id === nodeId);
      if (!nodeData || nodeId !== state.nodeId) return;

      if (nodeData.type === 'subnet') {
        const current = node.position();
        const start = state.startPositions[nodeId];
        if (!start) return;
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

      const updates = [...movedIds].map(id => {
        const pos = cy.getElementById(id).position();
        return { nodeId: id, position: { x: pos.x, y: pos.y } };
      });
      const previous = [...movedIds].map(id => ({
        nodeId: id,
        position: { ...state.startPositions[id]! },
      }));

      onNodePositionsChange(updates, previous);
    };

    cy.nodes().grabify();
    cy.on('tap', 'node', onNodeTap);
    cy.on('tap', 'edge', onEdgeTap);
    cy.on('tap', onBackgroundTap);
    cy.on('grab', 'node', onGrab);
    cy.on('drag', 'node', onDrag);
    cy.on('dragfree', 'node', onDragFree);

    return () => {
      cy.off('tap', 'node', onNodeTap);
      cy.off('tap', 'edge', onEdgeTap);
      cy.off('tap', onBackgroundTap);
      cy.off('grab', 'node', onGrab);
      cy.off('drag', 'node', onDrag);
      cy.off('dragfree', 'node', onDragFree);
    };
  }, [elements, nodes, edges, onNodeSelect, onEdgeSelect, onDeselect, onNodePositionsChange, t]);

  // Keep cytoscape selection in sync with sidebar selection.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().unselect();
    if (selectedNodeId) {
      const n = cy.getElementById(selectedNodeId);
      if (n.nonempty()) n.select();
    } else if (selectedEdgeId) {
      const e = cy.getElementById(selectedEdgeId);
      if (e.nonempty()) e.select();
    }
  }, [selectedNodeId, selectedEdgeId, elements]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        const cy = cyRef.current;
        cy?.nodes().removeClass('search-hit');
        cy?.elements().unselect();
        onDeselect?.();
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!selectedNodeId && !selectedEdgeId) return;
        event.preventDefault();
        onDeleteSelection?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onDeselect, onDeleteSelection, selectedNodeId, selectedEdgeId]);

  const handleZoomIn = () => {
    if (cyRef.current) {
      cyRef.current.zoom({
        level: cyRef.current.zoom() * 1.2,
        renderedPosition: {
          x: cyRef.current.width() / 2,
          y: cyRef.current.height() / 2,
        },
      });
    }
  };

  const handleZoomOut = () => {
    if (cyRef.current) {
      cyRef.current.zoom({
        level: cyRef.current.zoom() / 1.2,
        renderedPosition: {
          x: cyRef.current.width() / 2,
          y: cyRef.current.height() / 2,
        },
      });
    }
  };

  const handleFit = () => {
    if (cyRef.current) {
      cyRef.current.fit(undefined, 40);
    }
  };

  const handleZoomSelection = () => {
    const cy = cyRef.current;
    if (!cy) return;
    const selected = cy.$(':selected');
    if (selected.nonempty()) {
      cy.animate({ fit: { eles: selected, padding: 80 }, duration: 250 });
      return;
    }
    if (selectedNodeId) {
      focusNode(selectedNodeId);
      return;
    }
    handleFit();
  };

  const searchHits = useMemo(
    () => searchTopologyNodes(nodes, searchQuery),
    [nodes, searchQuery],
  );

  const searchOptions = searchHits.slice(0, 12).map(hit => ({
    value: hit.id,
    label: `${hit.label} (${hit.type}) · ${hit.id}`,
  }));

  const minimap = useMemo(() => {
    const positioned = elements.filter(isPositionedNodeElement);
    if (positioned.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const el of positioned) {
      minX = Math.min(minX, el.position.x);
      minY = Math.min(minY, el.position.y);
      maxX = Math.max(maxX, el.position.x);
      maxY = Math.max(maxY, el.position.y);
    }
    const pad = 40;
    minX -= pad;
    minY -= pad;
    maxX += pad;
    maxY += pad;
    const w = Math.max(maxX - minX, 1);
    const h = Math.max(maxY - minY, 1);

    return { positioned, minX, minY, w, h };
  }, [elements]);

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
    <div
      style={{ position: 'relative', width: '100%', height: '100%' }}
      role="region"
      aria-label={t('a11y.canvasRegion')}
    >
      <p className="visually-hidden" id="topology-canvas-desc">
        {t('a11y.canvasLimitations')} {t('canvas.shortcutsHelp')}
      </p>
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 1000,
          width: 'min(320px, calc(100% - 24px))',
        }}
      >
        <AutoComplete
          options={searchOptions}
          value={searchQuery}
          onChange={setSearchQuery}
          onSelect={(value: string) => {
            setSearchQuery(getNodeLabel(nodes.find(n => n.id === value)!) || value);
            focusNode(value);
          }}
          style={{ width: '100%' }}
        >
          <Input.Search
            allowClear
            placeholder={t('canvas.searchPlaceholder')}
            aria-label={t('canvas.searchPlaceholder')}
            enterButton={t('canvas.search')}
            onSearch={value => {
              const hits = searchTopologyNodes(nodes, value);
              if (hits[0]) focusNode(hits[0].id);
            }}
          />
        </AutoComplete>
      </div>

      <div
        style={{ width: '100%', height: '100%' }}
        aria-describedby="topology-canvas-desc"
        role="img"
        aria-label={t('a11y.canvasGraph')}
      >
        <CytoscapeComponent
          elements={elements}
          style={{ width: '100%', height: '100%' }}
          stylesheet={toStylesheet(styles)}
          layout={{ name: 'preset' }}
          cy={(cy: Core) => {
            cyRef.current = cy;
          }}
        />
      </div>

      {minimap && (
        <div
          role="img"
          aria-label={t('canvas.minimap')}
          title={t('canvas.minimapHint')}
          style={{
            position: 'absolute',
            bottom: 20,
            left: 12,
            zIndex: 1000,
            width: 140,
            height: 100,
            background: 'rgba(17, 24, 39, 0.9)',
            border: '1px solid #6b7280',
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          <svg width="100%" height="100%" viewBox={`0 0 ${minimap.w} ${minimap.h}`} preserveAspectRatio="xMidYMid meet">
            {minimap.positioned.map(el => {
              const isHit = el.data.id === selectedNodeId;
              const r = el.data.type === 'subnet' ? 14 : 10;
              return (
                <circle
                  key={el.data.id}
                  cx={el.position.x - minimap.minX}
                  cy={el.position.y - minimap.minY}
                  r={r}
                  fill={(el.data.color as string) || '#9ca3af'}
                  stroke={isHit ? '#FBBF24' : 'rgba(255,255,255,0.35)'}
                  strokeWidth={isHit ? 6 : 2}
                  style={{ cursor: 'pointer' }}
                  onClick={() => focusNode(el.data.id)}
                />
              );
            })}
          </svg>
        </div>
      )}

      <div
        className="canvas-toolbar"
        role="toolbar"
        aria-label={t('a11y.canvasToolbar')}
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          zIndex: 1000,
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '8px 10px',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(4px)',
          border: '1px solid #6b7280',
        }}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={handleZoomIn} style={chromeButtonStyle} aria-label={t('canvas.zoomIn')} title={t('canvas.zoomIn')}>
            +
          </button>
          <button type="button" onClick={handleZoomOut} style={chromeButtonStyle} aria-label={t('canvas.zoomOut')} title={t('canvas.zoomOut')}>
            −
          </button>
          <button type="button" onClick={handleFit} style={chromeButtonStyle} aria-label={t('canvas.fit')} title={t('canvas.fit')}>
            {t('canvas.fit')}
          </button>
          <button
            type="button"
            onClick={handleZoomSelection}
            style={chromeButtonStyle}
            aria-label={t('canvas.zoomSelection')}
            title={t('canvas.zoomSelection')}
          >
            {t('canvas.zoomSelection')}
          </button>
          {onResetLayout && (
            <button
              type="button"
              onClick={onResetLayout}
              style={chromeButtonStyle}
              aria-label={t('canvas.resetLayout')}
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
