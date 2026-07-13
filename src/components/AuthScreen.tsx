import React, { useState } from 'react';
import { Alert, Button, Card, Form, Input, Tabs, Typography } from 'antd';
import { ApiError } from '../api/client.ts';
import { useAuth } from '../auth/AuthProvider.tsx';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { translateApiError } from '../i18n/translations.ts';

const { Title, Paragraph } = Typography;

export const AuthScreen: React.FC = () => {
  const { t } = useI18n();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onFinish = async (values: { username: string; password: string }) => {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(values.username, values.password);
      } else {
        await register(values.username, values.password);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(translateApiError(err, t));
      } else {
        setError(t('auth.failed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0e1117',
        padding: 24,
      }}
    >
      <Card style={{ width: 400, maxWidth: '100%' }}>
        <Title level={3} style={{ marginTop: 0 }}>
          {t('app.title')}
        </Title>
        <Paragraph type="secondary">{t('auth.subtitle')}</Paragraph>
        <Tabs
          activeKey={mode}
          onChange={key => {
            setMode(key as 'login' | 'register');
            setError(null);
          }}
          items={[
            { key: 'login', label: t('auth.login') },
            { key: 'register', label: t('auth.register') },
          ]}
        />
        {error && (
          <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />
        )}
        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item
            name="username"
            label={t('auth.username')}
            rules={[{ required: true, message: t('auth.usernameRequired') }]}
          >
            <Input autoComplete="username" autoFocus />
          </Form.Item>
          <Form.Item
            name="password"
            label={t('auth.password')}
            rules={[{ required: true, message: t('auth.passwordRequired') }]}
          >
            <Input.Password autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitting}>
            {mode === 'login' ? t('auth.login') : t('auth.register')}
          </Button>
        </Form>
      </Card>
    </div>
  );
};
