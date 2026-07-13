import React from 'react';
import { Drawer, Layout } from 'antd';
import type { TopologyEdge, TopologyNode, TopologyNodeTypeValue, TopologySummary } from '../../shared/types.ts';
import type { SelectedNodeData } from '../hooks/useSelection.ts';
import { TopologyManager } from './TopologyManager.tsx';
import { NodePanel } from './NodePanel.tsx';
import { EdgePanel } from './EdgePanel.tsx';
import { SelectionDetail } from './SelectionDetail.tsx';

const { Sider } = Layout;

const panelStyle: React.CSSProperties = {
  padding: 16,
  height: '100%',
  overflow: 'auto',
};

const siderStyle: React.CSSProperties = {
  background: 'rgba(20, 24, 33, 0.85)',
  borderRight: '1px solid rgba(255, 255, 255, 0.08)',
  backdropFilter: 'blur(8px)',
};

interface TopologySidebarProps {
  topologies: TopologySummary[];
  activeTopologyId: string | null;
  nodes: TopologyNode[];
  selectedNodeId: string | null;
  selectedNodeData: SelectedNodeData | null;
  selectedEdgeId: string | null;
  selectedEdgeData: TopologyEdge | null;
  onSelectTopology: (id: string) => void;
  onCreateTopology: (name: string) => Promise<boolean>;
  onRenameTopology: (name: string) => Promise<boolean>;
  onDeleteTopology: () => void;
  onExportTopology: () => Promise<boolean>;
  onImportTopology: (file: File) => Promise<boolean>;
  onAddNode: (values: {
    nodeId: string;
    nodeType: TopologyNodeTypeValue;
    nodeLabel: string;
  }) => Promise<boolean>;
  onAddEdge: (values: { source: string; target: string; gateway?: string }) => Promise<boolean>;
  validateEdgeForm: (source: string, target: string) => string | null;
  onUpdateNodeLabel: (values: { label: string }) => Promise<void>;
  onDeleteNode: (nodeId: string) => void;
  onUpdateEdgeGateway: (values: { gateway?: string }) => Promise<void>;
  onDeleteEdge: (edgeId: string) => void;
  /** Narrow screens: render as left Drawer instead of fixed Sider. */
  isNarrow?: boolean;
  /** Desktop sider collapsed (also used to open/close drawer when narrow). */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export const TopologySidebar: React.FC<TopologySidebarProps> = ({
  topologies,
  activeTopologyId,
  nodes,
  selectedNodeId,
  selectedNodeData,
  selectedEdgeId,
  selectedEdgeData,
  onSelectTopology,
  onCreateTopology,
  onRenameTopology,
  onDeleteTopology,
  onExportTopology,
  onImportTopology,
  onAddNode,
  onAddEdge,
  validateEdgeForm,
  onUpdateNodeLabel,
  onDeleteNode,
  onUpdateEdgeGateway,
  onDeleteEdge,
  isNarrow = false,
  collapsed = false,
  onCollapsedChange,
}) => {
  const panels = (
    <div style={panelStyle} data-testid="topology-sidebar-panels">
      <TopologyManager
        topologies={topologies}
        activeTopologyId={activeTopologyId}
        onSelectTopology={onSelectTopology}
        onCreateTopology={onCreateTopology}
        onRenameTopology={onRenameTopology}
        onDeleteTopology={onDeleteTopology}
        onExportTopology={onExportTopology}
        onImportTopology={onImportTopology}
      />
      <NodePanel onAddNode={onAddNode} />
      <EdgePanel
        nodes={nodes}
        activeTopologyId={activeTopologyId}
        validateEdgeForm={validateEdgeForm}
        onAddEdge={onAddEdge}
      />
      <SelectionDetail
        selectedNodeId={selectedNodeId}
        selectedNodeData={selectedNodeData}
        selectedEdgeId={selectedEdgeId}
        selectedEdgeData={selectedEdgeData}
        onUpdateNodeLabel={onUpdateNodeLabel}
        onDeleteNode={onDeleteNode}
        onUpdateEdgeGateway={onUpdateEdgeGateway}
        onDeleteEdge={onDeleteEdge}
      />
    </div>
  );

  if (isNarrow) {
    return (
      <Drawer
        title={null}
        placement="left"
        width={Math.min(300, typeof window !== 'undefined' ? window.innerWidth - 24 : 300)}
        open={!collapsed}
        onClose={() => onCollapsedChange?.(true)}
        styles={{
          body: { padding: 0, background: 'rgba(20, 24, 33, 0.98)' },
          header: { display: 'none' },
        }}
        destroyOnClose={false}
        data-testid="topology-sidebar-drawer"
      >
        {/* Keep .ant-layout-sider class absent; E2E desktop still uses Sider path. */}
        <div className="ant-layout-sider" style={{ background: 'transparent', width: '100%' }}>
          {panels}
        </div>
      </Drawer>
    );
  }

  return (
    <Sider
      width={300}
      collapsedWidth={0}
      collapsible
      collapsed={collapsed}
      onCollapse={value => onCollapsedChange?.(value)}
      theme="dark"
      trigger={null}
      style={siderStyle}
      data-testid="topology-sidebar-sider"
    >
      {panels}
    </Sider>
  );
};
