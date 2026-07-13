import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Layout, message, Spin } from 'antd';
import { useTopologies } from './hooks/useTopologies.ts';
import { useTopology } from './hooks/useTopology.ts';
import { useSelection } from './hooks/useSelection.ts';
import { useTopologyMutations } from './hooks/useTopologyMutations.ts';
import { useCommandHistory } from './hooks/useCommandHistory.ts';
import { useI18n } from './i18n/I18nProvider.tsx';
import { AppHeader } from './components/AppHeader.tsx';
import { TopologySidebar } from './components/TopologySidebar.tsx';

const { Content } = Layout;

const TopologyGraph = lazy(() => import('./components/TopologyGraph'));

const graphFallbackStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
};

const App: React.FC = () => {
  const { t } = useI18n();
  const { topologies, error: topologiesError, refresh: refreshTopologies } = useTopologies(
    t('topologies.loadFailed'),
  );
  const [activeTopologyId, setActiveTopologyId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const {
    nodes: activeNodes,
    edges: activeEdges,
    loading: topologyLoading,
    error: topologyError,
  } = useTopology(activeTopologyId, refreshKey, t('canvas.loadFailedDetail'));

  const selection = useSelection(activeTopologyId, activeNodes, activeEdges);
  const bumpTopology = useCallback(() => setRefreshKey(k => k + 1), []);

  const {
    canUndo,
    canRedo,
    record: recordHistory,
    undo,
    redo,
  } = useCommandHistory(activeTopologyId, bumpTopology);

  const mutations = useTopologyMutations({
    activeTopologyId,
    setActiveTopologyId,
    nodes: activeNodes,
    edges: activeEdges,
    selectedNodeData: selection.selectedNodeData,
    selectedEdgeData: selection.selectedEdgeData,
    refreshTopologies,
    bumpTopology,
    clearNodeSelection: selection.clearNodeSelection,
    clearEdgeSelection: selection.clearEdgeSelection,
    setSelectedNodeData: selection.setSelectedNodeData,
    setSelectedEdgeData: selection.setSelectedEdgeData,
    recordHistory,
  });

  useEffect(() => {
    if (topologiesError) {
      message.error(topologiesError);
    }
  }, [topologiesError]);

  useEffect(() => {
    if (topologies.length > 0 && !activeTopologyId) {
      setActiveTopologyId(topologies[0].id);
    }
  }, [topologies, activeTopologyId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }

      const mod = event.metaKey || event.ctrlKey;
      if (!mod || event.altKey) return;

      if (event.key === 'z' || event.key === 'Z') {
        if (event.shiftKey) {
          if (!canRedo) return;
          event.preventDefault();
          void redo();
        } else {
          if (!canUndo) return;
          event.preventDefault();
          void undo();
        }
        return;
      }

      if (event.key === 'y' || event.key === 'Y') {
        if (!canRedo) return;
        event.preventDefault();
        void redo();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canUndo, canRedo, undo, redo]);

  return (
    <Layout style={{ height: '100vh', background: '#0e1117' }}>
      <AppHeader
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => void undo()}
        onRedo={() => void redo()}
      />
      <Layout style={{ background: '#0e1117' }}>
        <TopologySidebar
          topologies={topologies}
          activeTopologyId={activeTopologyId}
          nodes={activeNodes}
          selectedNodeId={selection.selectedNodeId}
          selectedNodeData={selection.selectedNodeData}
          selectedEdgeId={selection.selectedEdgeId}
          selectedEdgeData={selection.selectedEdgeData}
          onSelectTopology={setActiveTopologyId}
          onCreateTopology={mutations.createTopology}
          onRenameTopology={mutations.renameTopology}
          onDeleteTopology={mutations.deleteTopology}
          onExportTopology={mutations.exportTopology}
          onImportTopology={mutations.importTopology}
          onAddNode={mutations.addNode}
          onAddEdge={mutations.addEdge}
          validateEdgeForm={mutations.validateEdgeForm}
          onUpdateNodeLabel={mutations.updateNodeLabel}
          onDeleteNode={mutations.deleteNode}
          onUpdateEdgeGateway={mutations.updateEdgeGateway}
          onDeleteEdge={mutations.deleteEdge}
        />
        <Content
          style={{
            padding: 0,
            background: '#0e1117',
            backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.08) 1.5px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        >
          <Suspense
            fallback={
              <div style={graphFallbackStyle}>
                <Spin size="large" tip={t('canvas.loading')} />
              </div>
            }
          >
            <TopologyGraph
              nodes={activeNodes}
              edges={activeEdges}
              loading={topologyLoading}
              error={topologyError}
              hasTopology={!!activeTopologyId}
              onRetry={bumpTopology}
              onNodeSelect={selection.selectNode}
              onEdgeSelect={selection.selectEdge}
              onNodePositionsChange={mutations.saveNodePositions}
            />
          </Suspense>
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;
