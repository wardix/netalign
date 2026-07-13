import { afterEach, describe, expect, test } from 'bun:test';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { GraphErrorBoundary } from './GraphErrorBoundary.tsx';
import { translations, type TranslationKey } from '../i18n/translations.ts';

const t = (key: TranslationKey) => translations.en[key] ?? key;

function Boom(): React.ReactElement {
  throw new Error('simulated graph crash');
}

function Safe({ label }: { label: string }): React.ReactElement {
  return <div data-testid="safe-child">{label}</div>;
}

describe('GraphErrorBoundary', () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function mount(ui: React.ReactElement) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(ui);
    });
  }

  test('shows fallback when a child throws during render', () => {
    // React logs expected errors to the console during error-boundary tests.
    const consoleError = console.error;
    console.error = () => {};

    mount(
      <GraphErrorBoundary t={t}>
        <Boom />
      </GraphErrorBoundary>,
    );

    expect(container.querySelector('[data-testid="graph-error-boundary"]')).not.toBeNull();
    expect(container.textContent).toContain(translations.en['canvas.crashTitle']);
    expect(container.textContent).toContain(translations.en['common.retry']);

    console.error = consoleError;
  });

  test('clears error when resetKey changes', () => {
    const consoleError = console.error;
    console.error = () => {};

    mount(
      <GraphErrorBoundary t={t} resetKey="topology-a">
        <Boom />
      </GraphErrorBoundary>,
    );
    expect(container.querySelector('[data-testid="graph-error-boundary"]')).not.toBeNull();

    act(() => {
      root.render(
        <GraphErrorBoundary t={t} resetKey="topology-b">
          <Safe label="recovered" />
        </GraphErrorBoundary>,
      );
    });

    expect(container.querySelector('[data-testid="graph-error-boundary"]')).toBeNull();
    expect(container.querySelector('[data-testid="safe-child"]')?.textContent).toBe('recovered');

    console.error = consoleError;
  });

  test('retry clears error and re-renders children', () => {
    const consoleError = console.error;
    console.error = () => {};

    let shouldThrow = true;
    function MaybeBoom(): React.ReactElement {
      if (shouldThrow) throw new Error('boom once');
      return <Safe label="after-retry" />;
    }

    mount(
      <GraphErrorBoundary t={t}>
        <MaybeBoom />
      </GraphErrorBoundary>,
    );
    expect(container.querySelector('[data-testid="graph-error-boundary"]')).not.toBeNull();

    shouldThrow = false;
    const button = container.querySelector('button') as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    act(() => {
      button!.click();
    });

    expect(container.querySelector('[data-testid="safe-child"]')?.textContent).toBe('after-retry');

    console.error = consoleError;
  });
});
