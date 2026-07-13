import React from 'react';
import { Button, Empty, Space, Steps, Typography } from 'antd';
import { useI18n } from '../i18n/I18nProvider.tsx';

const { Text, Paragraph } = Typography;

const overlayStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  padding: 24,
  color: '#9ca3af',
};

const cardStyle: React.CSSProperties = {
  maxWidth: 440,
  width: '100%',
  background: 'rgba(20, 24, 33, 0.92)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: 12,
  padding: 24,
  backdropFilter: 'blur(8px)',
};

interface EmptyTopologyGuideProps {
  onScaffoldSample?: () => void | Promise<void>;
  scaffolding?: boolean;
}

export const EmptyTopologyGuide: React.FC<EmptyTopologyGuideProps> = ({
  onScaffoldSample,
  scaffolding = false,
}) => {
  const { t } = useI18n();

  return (
    <div style={overlayStyle} data-testid="empty-topology-guide">
      <div style={cardStyle}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Text style={{ color: '#e5e7eb', fontSize: 16, fontWeight: 600 }}>
              {t('wizard.title')}
            </Text>
          }
        />
        <Paragraph style={{ color: '#9ca3af', textAlign: 'center', marginTop: 8 }}>
          {t('wizard.subtitle')}
        </Paragraph>

        <Steps
          direction="vertical"
          size="small"
          current={-1}
          style={{ marginTop: 16 }}
          items={[
            {
              title: <Text style={{ color: '#e5e7eb' }}>{t('wizard.step1Title')}</Text>,
              description: <Text type="secondary">{t('wizard.step1Body')}</Text>,
            },
            {
              title: <Text style={{ color: '#e5e7eb' }}>{t('wizard.step2Title')}</Text>,
              description: <Text type="secondary">{t('wizard.step2Body')}</Text>,
            },
            {
              title: <Text style={{ color: '#e5e7eb' }}>{t('wizard.step3Title')}</Text>,
              description: <Text type="secondary">{t('wizard.step3Body')}</Text>,
            },
          ]}
        />

        <Paragraph style={{ color: '#6b7280', fontSize: 12, marginTop: 8, marginBottom: 16 }}>
          {t('wizard.rules')}
        </Paragraph>

        {onScaffoldSample && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Button
              type="primary"
              block
              loading={scaffolding}
              onClick={() => void onScaffoldSample()}
            >
              {t('wizard.scaffold')}
            </Button>
            <Text type="secondary" style={{ display: 'block', textAlign: 'center', fontSize: 12 }}>
              {t('wizard.orSidebar')}
            </Text>
          </Space>
        )}
      </div>
    </div>
  );
};
