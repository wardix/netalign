// src/components/TopologyGraph.tsx
import React, { useEffect, useState, useRef } from 'react';
import { Alert, Button, Empty, Spin } from 'antd';
import CytoscapeComponent from 'react-cytoscapejs';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { computeLayout, type LayoutEdge } from '../../shared/layoutEngine.ts';
import type { TopologyNode } from '../../shared/topologyNodes.ts';

interface TopologyGraphProps {
  nodes: TopologyNode[];
  edges: LayoutEdge[];
  loading?: boolean;
  error?: string | null;
  hasTopology?: boolean;
  onRetry?: () => void;
  onNodeSelect?: (nodeId: string) => void;
  onEdgeSelect?: (edgeId: string) => void;
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
}) => {
  const { t } = useI18n();
  const [elements, setElements] = useState<any[]>([]);
  const [styles, setStyles] = useState<any[]>([]);
  const cyRef = useRef<any>(null);

  useEffect(() => {
    const { elements: cyElements, styles: cyStyles } = computeLayout(nodes, edges);
    setElements(cyElements);
    setStyles(cyStyles);
  }, [nodes, edges]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const onNodeTap = (evt: any) => {
      const id = evt.target.id();
      if (onNodeSelect) onNodeSelect(id);
    };
    const onEdgeTap = (evt: any) => {
      const id = evt.target.id();
      if (onEdgeSelect) onEdgeSelect(id);
    };
    cy.on('tap', 'node', onNodeTap);
    cy.on('tap', 'edge', onEdgeTap);
    return () => {
      cy.removeListener('tap', 'node', onNodeTap);
      cy.removeListener('tap', 'edge', onEdgeTap);
    };
  }, [elements, onNodeSelect, onEdgeSelect]);

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

  if (error) {
    return (
      <div style={canvasOverlayStyle}>
        <Alert
          type="error"
          showIcon
          message={t('canvas.loadFailed')}
          description={error}
          action={
            onRetry ? (
              <Button size="small" onClick={onRetry}>
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
      <div style={canvasOverlayStyle}>
        <Empty description={t('canvas.noNodes')} />
      </div>
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
        </div>
      </div>
    </div>
  );
};

export default TopologyGraph;