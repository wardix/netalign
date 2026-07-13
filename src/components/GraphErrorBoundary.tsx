import React from 'react';
import { Alert, Button } from 'antd';
import type { TranslationKey } from '../i18n/translations.ts';

export interface GraphErrorBoundaryProps {
  children: React.ReactNode;
  /** When this key changes (e.g. topology id), clear the error and remount children. */
  resetKey?: string | null;
  onRetry?: () => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

interface GraphErrorBoundaryState {
  error: Error | null;
}

const fallbackStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  padding: 24,
};

/**
 * Isolates topology graph / layout render failures so the app shell stays usable.
 */
export class GraphErrorBoundary extends React.Component<
  GraphErrorBoundaryProps,
  GraphErrorBoundaryState
> {
  state: GraphErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): GraphErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Topology graph crashed', error, info.componentStack);
  }

  componentDidUpdate(prevProps: GraphErrorBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
    this.props.onRetry?.();
  };

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    const { t } = this.props;
    return (
      <div style={fallbackStyle} data-testid="graph-error-boundary">
        <Alert
          type="error"
          showIcon
          message={t('canvas.crashTitle')}
          description={t('canvas.crashDetail')}
          action={
            <Button size="small" onClick={this.handleRetry}>
              {t('common.retry')}
            </Button>
          }
          style={{ maxWidth: 420 }}
        />
      </div>
    );
  }
}
