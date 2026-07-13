declare module 'react-cytoscapejs' {
  import type { ComponentType, CSSProperties } from 'react';
  import type { Core, ElementDefinition, LayoutOptions, StylesheetJson } from 'cytoscape';

  interface CytoscapeComponentProps {
    elements: ElementDefinition[] | ElementDefinition;
    stylesheet?: StylesheetJson;
    style?: CSSProperties;
    layout?: LayoutOptions | { name: string; [key: string]: unknown };
    cy?: (cy: Core) => void;
    className?: string;
  }

  const CytoscapeComponent: ComponentType<CytoscapeComponentProps>;
  export default CytoscapeComponent;
}