import React from 'react';
import { Button, Layout, Select, Space, Tooltip } from 'antd';
import { useI18n } from '../i18n/I18nProvider.tsx';

const { Header } = Layout;

interface AppHeaderProps {
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}) => {
  const { t, locale, setLocale } = useI18n();
  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  const undoShortcut = isMac ? '⌘Z' : 'Ctrl+Z';
  const redoShortcut = isMac ? '⌘⇧Z' : 'Ctrl+Shift+Z';

  return (
    <Header
      style={{
        background: 'rgba(20, 24, 33, 0.85)',
        color: '#f3f4f6',
        fontSize: 20,
        fontWeight: '600',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <span>{t('app.title')}</span>
      <Space size={8} style={{ marginLeft: 8 }}>
        <Tooltip title={`${t('history.undo')} (${undoShortcut})`}>
          <Button size="small" disabled={!canUndo || !onUndo} onClick={onUndo}>
            {t('history.undo')}
          </Button>
        </Tooltip>
        <Tooltip title={`${t('history.redo')} (${redoShortcut})`}>
          <Button size="small" disabled={!canRedo || !onRedo} onClick={onRedo}>
            {t('history.redo')}
          </Button>
        </Tooltip>
      </Space>
      <Select
        size="small"
        value={locale}
        onChange={setLocale}
        style={{ width: 72, marginLeft: 'auto' }}
        options={[
          { value: 'id', label: t('locale.id') },
          { value: 'en', label: t('locale.en') },
        ]}
      />
    </Header>
  );
};
