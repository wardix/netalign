import React from 'react';
import { Button, Layout, Select, Space, Tooltip } from 'antd';
import { useI18n } from '../i18n/I18nProvider.tsx';

const { Header } = Layout;

interface AppHeaderProps {
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  /** When true, show control to open the topology panel (collapsed sider / mobile drawer). */
  showPanelToggle?: boolean;
  panelOpen?: boolean;
  onTogglePanel?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  showPanelToggle = false,
  panelOpen = true,
  onTogglePanel,
}) => {
  const { t, locale, setLocale } = useI18n();
  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  const undoShortcut = isMac ? '⌘Z' : 'Ctrl+Z';
  const redoShortcut = isMac ? '⌘⇧Z' : 'Ctrl/Cmd+Shift+Z';

  return (
    <Header
      role="banner"
      style={{
        background: 'rgba(20, 24, 33, 0.85)',
        color: '#f3f4f6',
        fontSize: 20,
        fontWeight: '600',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        paddingInline: 16,
        minHeight: 64,
      }}
    >
      {showPanelToggle && onTogglePanel && (
        <Tooltip title={panelOpen ? t('layout.hidePanel') : t('layout.showPanel')}>
          <Button
            size="middle"
            type={panelOpen ? 'default' : 'primary'}
            onClick={onTogglePanel}
            aria-expanded={panelOpen}
            aria-controls="topology-sidebar"
            aria-label={panelOpen ? t('layout.hidePanel') : t('layout.showPanel')}
            style={{ minWidth: 44, minHeight: 36 }}
          >
            {panelOpen ? t('layout.hidePanel') : t('layout.showPanel')}
          </Button>
        </Tooltip>
      )}
      <span style={{ whiteSpace: 'nowrap' }}>{t('app.title')}</span>
      <Space size={8} style={{ marginLeft: 4 }} wrap role="group" aria-label={t('a11y.historyGroup')}>
        <Tooltip title={`${t('history.undo')} (${undoShortcut})`}>
          <Button
            size="small"
            disabled={!canUndo || !onUndo}
            onClick={onUndo}
            aria-label={`${t('history.undo')} (${undoShortcut})`}
            aria-keyshortcuts={isMac ? 'Meta+Z' : 'Control+Z'}
          >
            {t('history.undo')}
          </Button>
        </Tooltip>
        <Tooltip title={`${t('history.redo')} (${redoShortcut})`}>
          <Button
            size="small"
            disabled={!canRedo || !onRedo}
            onClick={onRedo}
            aria-label={`${t('history.redo')} (${redoShortcut})`}
            aria-keyshortcuts={isMac ? 'Meta+Shift+Z' : 'Control+Shift+Z'}
          >
            {t('history.redo')}
          </Button>
        </Tooltip>
      </Space>
      <Select
        size="small"
        value={locale}
        onChange={setLocale}
        style={{ width: 72, marginLeft: 'auto' }}
        aria-label={t('a11y.localeSelect')}
        options={[
          { value: 'id', label: t('locale.id') },
          { value: 'en', label: t('locale.en') },
        ]}
      />
    </Header>
  );
};
