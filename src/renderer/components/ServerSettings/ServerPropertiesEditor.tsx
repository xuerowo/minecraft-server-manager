import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Switch,
  Select,
  Button,
  Space,
  Typography,
  Tabs,
  message,
  Spin,
  Alert,
  Tooltip,
} from 'antd';
import {
  SaveOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  SettingOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import {
  SERVER_PROPERTIES_CONFIG,
  SERVER_PROPERTY_CATEGORIES,
  type ServerPropertyConfig,
} from '@shared/constants/serverProperties';
import type { ServerProperties } from '@shared/types';
import { useI18n } from '../../hooks/useI18n';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

interface ServerPropertiesEditorProps {
  serverId: string;
  serverName: string;
}

export const ServerPropertiesEditor: React.FC<ServerPropertiesEditorProps> = ({
  serverId,
  serverName,
}) => {
  const { t } = useI18n();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [properties, setProperties] = useState<ServerProperties>({});
  const [hasChanges, setHasChanges] = useState(false);

  // 載入 server.properties
  const loadProperties = async () => {
    setLoading(true);
    try {
      const props = await window.electronAPI.getServerProperties(serverId);
      setProperties(props);
      
      // 設定表單值，只設定實際存在的屬性
      const formValues: Record<string, any> = {};
      Object.keys(props).forEach(key => {
        formValues[key] = props[key];
      });
      
      form.setFieldsValue(formValues);
      setHasChanges(false);
      message.success(t('serverSettings.configLoaded'));
    } catch (error: any) {
      message.error(t('serverSettings.configLoadFailed', { error: error.message || t('errors.unknownError') }));
      console.error('載入配置失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  // 儲存 server.properties
  const saveProperties = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      
      // 只傳送有變更的屬性
      const changes: Record<string, any> = {};
      Object.entries(values).forEach(([key, value]) => {
        if (properties[key] !== value) {
          changes[key] = value;
        }
      });
      
      if (Object.keys(changes).length > 0) {
        await window.electronAPI.updateProperties(serverId, changes);
        setProperties(values);
        setHasChanges(false);
        message.success(t('serverSettings.configSaved'));
      } else {
        message.info(t('serverSettings.noChangesToSave'));
        setHasChanges(false);
      }
    } catch (error: any) {
      if (error.errorFields) {
        message.error(t('serverSettings.checkFormErrors'));
      } else {
        message.error(t('serverSettings.configSaveFailed', { error: error.message || t('errors.unknownError') }));
        console.error('儲存配置失敗:', error);
      }
    } finally {
      setSaving(false);
    }
  };

  // 重置配置
  const resetProperties = () => {
    form.setFieldsValue(properties);
    setHasChanges(false);
    message.info(t('serverSettings.configReset'));
  };

  // 打開檔案
  const openPropertiesFile = async () => {
    try {
      const server = await window.electronAPI.getServerList();
      const currentServer = server.find(s => s.id === serverId);
      if (currentServer) {
        // 使用 shell 直接開啟 server.properties 檔案
        const propertiesPath = `${currentServer.path}/server.properties`;
        await window.electronAPI.openDirectory(propertiesPath);
      }
    } catch (error: any) {
      message.error(t('serverSettings.openFileFailed', { error: error.message || t('errors.unknownError') }));
      console.error('開啟檔案失敗:', error);
    }
  };

  // 監聽表單變化
  const handleFormChange = () => {
    setHasChanges(true);
  };

  useEffect(() => {
    loadProperties();
  }, [serverId]);

  // 根據配置項目類型渲染對應的表單控制項
  const renderFormItem = (config: ServerPropertyConfig) => {
    const { key, type, options, min, max, defaultValue } = config;
    
    const translatedLabel = t(`serverProperties.properties.${key}.label`, { defaultValue: config.label });
    const translatedDescription = t(`serverProperties.properties.${key}.description`, { defaultValue: config.description });
    
    // 檢查該屬性是否在實際的 server.properties 中存在
    const propertyExists = key in properties;
    const isDisabled = !propertyExists;

    let control;
    
    switch (type) {
      case 'boolean':
        control = (
          <Switch 
            checkedChildren={t('serverSettings.enable')} 
            unCheckedChildren={t('serverSettings.disable')}
            defaultChecked={defaultValue as boolean}
            disabled={isDisabled}
          />
        );
        break;
        
      case 'number':
        control = (
          <InputNumber
            min={min}
            max={max}
            style={{ width: '100%' }}
            placeholder={t('serverSettings.defaultValue', { defaultValue })}
            disabled={isDisabled}
          />
        );
        break;
        
      case 'select':
        // 國際化選項
        const translatedOptions = options?.map(option => ({
          value: option.value,
          label: t(`serverProperties.options.${key}.${option.value}`, { defaultValue: option.label })
        })) || [];
        
        control = (
          <Select
            placeholder={t('serverSettings.selectPlaceholder', { label: translatedLabel })}
            style={{ width: '100%' }}
            options={translatedOptions}
            disabled={isDisabled}
          />
        );
        break;
        
      default:
        control = (
          <Input
            placeholder={defaultValue ? t('serverSettings.defaultValue', { defaultValue }) : t('serverSettings.inputPlaceholder', { label: translatedLabel })}
            disabled={isDisabled}
          />
        );
    }

    return (
      <Form.Item
        key={key}
        name={key}
        label={
          <Space>
            <Text strong>{translatedLabel}</Text>
            <Tooltip 
              title={
                <div>
                  <div>{translatedDescription}</div>
                  <div className="mt-1 text-gray-400">{t('serverSettings.propertyName')}: <code>{key}</code></div>
                  {isDisabled && (
                    <div className="mt-1 text-orange-500">
                      {t('serverSettings.propertyUnavailable')}
                    </div>
                  )}
                </div>
              }
            >
              <InfoCircleOutlined className="text-gray-400 cursor-help" />
            </Tooltip>
            {isDisabled && (
              <span className="text-xs text-orange-500">({t('serverSettings.unavailable')})</span>
            )}
          </Space>
        }
        className="mb-4"
        valuePropName={type === 'boolean' ? 'checked' : 'value'}
      >
        {control}
      </Form.Item>
    );
  };

  // 按類別分組配置項目
  const groupedConfigs = Object.entries(SERVER_PROPERTY_CATEGORIES).map(([key, categoryName]) => ({
    key: key.toLowerCase(),
    name: t(`serverProperties.categories.${key}`, { defaultValue: categoryName }),
    configs: SERVER_PROPERTIES_CONFIG.filter(config => config.category === categoryName),
  }));

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <Space>
            <Spin size="large" />
            <Text>{t('serverSettings.loadingConfig')}</Text>
          </Space>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 標題和操作按鈕 */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <Title level={4} className="!mb-1">
              <SettingOutlined className="mr-2" />
              {t('serverSettings.editorTitle')}
            </Title>
            <Paragraph className="!mb-0 text-gray-400">
              {t('serverSettings.editorDescription', { serverName })}
            </Paragraph>
          </div>
          <Space>
            <Button
              icon={<FileTextOutlined />}
              onClick={openPropertiesFile}
              disabled={saving}
            >
              {t('serverSettings.openFile')}
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadProperties}
              disabled={saving}
            >
              {t('serverSettings.reload')}
            </Button>
            <Button
              onClick={resetProperties}
              disabled={!hasChanges || saving}
            >
              {t('serverSettings.resetChanges')}
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={saveProperties}
              loading={saving}
              disabled={!hasChanges}
            >
              {t('serverSettings.saveConfig')}
            </Button>
          </Space>
        </div>

        {hasChanges && (
          <Alert
            message={t('serverSettings.unsavedChanges')}
            description={t('serverSettings.unsavedChangesDescription')}
            type="warning"
            showIcon
            className="mt-4"
          />
        )}
      </Card>

      {/* 配置編輯表單 */}
      <Card>
        <Form
          form={form}
          layout="vertical"
          onValuesChange={handleFormChange}
          size="large"
        >
          <Tabs
            defaultActiveKey="basic"
            type="card"
            className="server-properties-tabs"
          >
            {groupedConfigs.map(({ key, name, configs }) => (
              <TabPane
                tab={
                  <Space>
                    <span>{name}</span>
                    <span className="text-xs text-gray-400">
                      ({configs.length})
                    </span>
                  </Space>
                }
                key={key}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {configs.map(renderFormItem)}
                </div>
                
                {configs.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <Text>{t('serverSettings.noPropertiesInCategory')}</Text>
                  </div>
                )}
              </TabPane>
            ))}
          </Tabs>
        </Form>
      </Card>

      {/* 說明資訊 */}
      <Card>
        <Alert
          message={t('serverSettings.usageTips')}
          description={
            <div className="space-y-2 text-sm">
              <p>• {t('serverSettings.tipRestartRequired')}</p>
              <p>• {t('serverSettings.tipPerformanceImpact')}</p>
              <p>• {t('serverSettings.tipBackupRecommended')}</p>
              <p>• {t('serverSettings.tipKeepDefault')}</p>
            </div>
          }
          type="info"
          showIcon
        />
      </Card>
    </div>
  );
};