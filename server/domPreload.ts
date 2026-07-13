import { Window } from 'happy-dom';

const window = new Window({ url: 'http://localhost/' });
const { document } = window;

// Minimal global DOM for React component unit tests under Bun.
Object.assign(globalThis, {
  window,
  document,
  HTMLElement: window.HTMLElement,
  Node: window.Node,
  DocumentFragment: window.DocumentFragment,
  MutationObserver: window.MutationObserver,
  MouseEvent: window.MouseEvent,
  Event: window.Event,
  getComputedStyle: window.getComputedStyle.bind(window),
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  navigator: window.navigator,
});

// React 19 act() checks for a testing env flag when using concurrent features.
// @ts-expect-error intentional test env marker
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
