import { useEffect, useState } from 'react';
import { ConfigProvider, Spin } from 'antd';
import type { Locale } from 'antd/es/locale';
import App from './App.tsx';
import { useI18n } from './i18n/I18nProvider.tsx';

const localeLoaders = {
  id: () => import('antd/locale/id_ID'),
  en: () => import('antd/locale/en_US'),
} as const;

export default function Root() {
  const { locale } = useI18n();
  const [antdLocale, setAntdLocale] = useState<Locale | undefined>();

  useEffect(() => {
    let cancelled = false;
    setAntdLocale(undefined);
    localeLoaders[locale]()
      .then(mod => {
        if (!cancelled) setAntdLocale(mod.default);
      })
      .catch(err => {
        console.error('Failed to load Ant Design locale', err);
      });

    return () => {
      cancelled = true;
    };
  }, [locale]);

  if (!antdLocale) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#0e1117',
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  return (
    <ConfigProvider locale={antdLocale}>
      <App />
    </ConfigProvider>
  );
}