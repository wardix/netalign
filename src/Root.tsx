import { ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import idID from 'antd/locale/id_ID';
import App from './App.tsx';
import { useI18n } from './i18n/I18nProvider.tsx';

export default function Root() {
  const { locale } = useI18n();

  return (
    <ConfigProvider locale={locale === 'id' ? idID : enUS}>
      <App />
    </ConfigProvider>
  );
}