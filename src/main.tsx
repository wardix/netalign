import { createRoot } from 'react-dom/client';
import './index.css';
import { I18nProvider } from './i18n/I18nProvider.tsx';
import Root from './Root.tsx';
import 'antd/dist/reset.css';

createRoot(document.getElementById('root')!).render(
  <I18nProvider>
    <Root />
  </I18nProvider>,
);