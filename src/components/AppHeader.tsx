import React from 'react';
import { Layout, Select } from 'antd';
import { useI18n } from '../i18n/I18nProvider.tsx';

const { Header } = Layout;

export const AppHeader: React.FC = () => {
  const { t, locale, setLocale } = useI18n();

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
