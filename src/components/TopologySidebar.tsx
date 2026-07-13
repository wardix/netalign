import React from 'react';
import { Layout } from 'antd';
import type { TopologyEdge, TopologyNode, TopologyNodeTypeValue, TopologySummary } from '../../shared/types.ts';
import type { SelectedNodeData } from '../hooks/useSelection.ts';
import { TopologyManager } from './TopologyManager.tsx';
import { NodePanel } from './NodePanel.tsx';
import { EdgePanel } from './EdgePanel.tsx';
import { SelectionDetail } from './SelectionDetail.tsx';

const { Sider } = Layout;

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
}) => {
  return (
    <Sider
      width={300}
      theme="dark"
      style={{
        background: 'rgba(20, 24, 33, 0.85)',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        padding: 16,
        overflow: 'auto',
        backdropFilter: 'blur(8px)',
      }}
    >
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
    </Sider>
  );
};
