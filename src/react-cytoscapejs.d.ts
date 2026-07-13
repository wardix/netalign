declare module 'react-cytoscapejs' {
  import type { ComponentType } from 'react';
  import type { Core, ElementDefinition, Stylesheet } from 'cytoscape';

  interface CytoscapeComponentProps {
    elements: ElementDefinition[];
    stylesheet?: Stylesheet[] | object[];
    style?: React.CSSProperties;
    layout?: object;
    cy?: (cy: Core) => void;
  }

  const CytoscapeComponent: ComponentType<CytoscapeComponentProps>;
  export default CytoscapeComponent;
}