import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Form,
  Input,
  Button,
  Switch,
  Select,
  Divider,
  Space,
  message,
  Alert,
  Slider,
  InputNumber,
  Tabs,
  Row,
  Col,
  Tag,
  Tooltip,
  Modal
} from 'antd';
import {
  SettingOutlined,
  FolderOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useI18n } from '../hooks/useI18n';
import { useI18nContext } from '../components/I18nProvider';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface AppSettings {
  // 介面設定
  language: 'zh-TW' | 'zh-CN' | 'en-US';
  customServerPath: string;
}

export const AppSettings: React.FC = () => {
  const { t } = useI18n();
  const { setLanguage } = useI18nContext();
  const [form] = Form.useForm();
  const [settings, setSettings] = useState<AppSettings>({
    language: 'zh-TW',
    customServerPath: ''
  });
  

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    // 當 settings 更新時，確保表單值也更新
    form.setFieldsValue(settings);
  }, [settings, form]);

  const loadSettings = async () => {
    try {
      const loadedSettings = await window.electronAPI.loadSettings();
      setSettings(loadedSettings);
      form.setFieldsValue(loadedSettings);
    } catch (error) {
      message.error(t('settings.loadError'));
      console.error('載入設定失敗:', error);
    }
  };






  const generalSettings = (
    <Card title={<><SettingOutlined /> {t('settings.general')}</>} className="mb-4">
      <Row gutter={24}>
        <Col span={12}>
          <Form.Item
            name="language"
            label={t('settings.language')}
            tooltip={t('settings.languageTooltip')}
          >
            <Select onChange={(value) => setLanguage(value as LanguageCode)}>
              <Option value="zh-TW">{t('languageOptions.zh-TW')}</Option>
              <Option value="zh-CN">{t('languageOptions.zh-CN')}</Option>
              <Option value="en-US">{t('languageOptions.en-US')}</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>
      
    </Card>
  );



  return (
    <div className="p-6">
        <div className="mb-6">
          <Title level={3} className="!text-white !mb-2">
            {t('app.title')}
          </Title>
          <Text type="secondary">
            {t('app.description')}
          </Text>
        </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={settings}
      >
        <Tabs
          defaultActiveKey="general"
          items={[
            {
              key: 'general',
              label: (
                <span>
                  <SettingOutlined />
                  {t('settings.general')}
                </span>
              ),
              children: (
                <>
                  {generalSettings}
                </>
              )
            },
            {
              key: 'about',
              label: (
                <span>
                  <InfoCircleOutlined />
                  {t('about.title')}
                </span>
              ),
              children: (
                <Card title={<><InfoCircleOutlined /> {t('about.title')}</>}>
                  <Row gutter={24}>
                    <Col span={12}>
                      <div className="space-y-4">
                        <div>
                          <Text strong>{t('about.appName')}</Text>
                          <br />
                          <Text>{t('about.appNameValue')}</Text>
                        </div>
                        <div>
                          <Text strong>{t('about.version')}</Text>
                          <br />
                          <Text>1.0.0</Text>
                          <Tag color="green" className="ml-2">最新</Tag>
                        </div>
                        <div>
                          <Text strong>{t('about.developer')}</Text>
                          <br />
                          <Text>Claude Code</Text>
                        </div>
                      </div>
                    </Col>
                    <Col span={12}>
                      <div className="space-y-4">
                        <div>
                          <Text strong>{t('about.techStack')}</Text>
                          <br />
                          <Space wrap>
                            <Tag>Electron</Tag>
                            <Tag>React</Tag>
                            <Tag>TypeScript</Tag>
                            <Tag>Ant Design</Tag>
                            <Tag>Tailwind CSS</Tag>
                          </Space>
                        </div>
                        <div>
                          <Text strong>{t('about.license')}</Text>
                          <br />
                          <Text>MIT License</Text>
                        </div>
                      </div>
                    </Col>
                  </Row>
                  
                  <Divider />
                  
                  <Paragraph>
                    {t('about.description')}
                  </Paragraph>
                </Card>
              )
            }
          ]}
        />

      </Form>

    </div>
  );
};