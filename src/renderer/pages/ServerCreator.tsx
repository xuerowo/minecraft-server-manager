import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Card, 
  Form, 
  Input, 
  Select, 
  Button, 
  Steps, 
  Row, 
  Col, 
  Progress, 
  Alert, 
  Typography, 
  Space,
  InputNumber,
  Divider,
  message
} from 'antd';
import { 
  DatabaseOutlined, 
  SettingOutlined, 
  CheckCircleOutlined, 
  LoadingOutlined 
} from '@ant-design/icons';
import { ServerType, ServerCreationConfig, ServerTypeInfo, AvailableVersion, CreationProgress } from '../../shared/types';
import { useI18n } from '../hooks/useI18n';

const { Title, Text } = Typography;
const { Step } = Steps;

interface ServerCreatorProps {}

export const ServerCreator: React.FC<ServerCreatorProps> = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [serverTypes, setServerTypes] = useState<ServerTypeInfo[]>([]);
  const [availableVersions, setAvailableVersions] = useState<AvailableVersion[]>([]);
  const [selectedType, setSelectedType] = useState<ServerType | null>(null);
  const [creationProgress, setCreationProgress] = useState<CreationProgress | null>(null);
  const [recommendedPort, setRecommendedPort] = useState<number>(25565);
  
  // 使用狀態來保存表單數據
  const [formData, setFormData] = useState<Partial<ServerCreationConfig>>({
    minMemory: '1G',
    maxMemory: '2G',
    javaArgs: []
  });

  useEffect(() => {
    loadServerTypes();
    loadRecommendedPort();
  }, []);

  useEffect(() => {
    if (selectedType) {
      loadAvailableVersions(selectedType);
    }
  }, [selectedType]);

  const loadServerTypes = async () => {
    try {
      const types = await window.electronAPI.getServerTypes();
      setServerTypes(types);
    } catch (error) {
      message.error(t('serverCreator.loadServerTypesFailed'));
      console.error('載入伺服器類型失敗:', error);
    }
  };

  const loadAvailableVersions = async (type: ServerType) => {
    setLoading(true);
    try {
      const versions = await window.electronAPI.getAvailableVersions(type);
      setAvailableVersions(versions);
    } catch (error) {
      message.error(t('serverCreator.loadVersionsFailed', { type }));
      console.error('載入版本列表失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecommendedPort = async () => {
    try {
      const port = await window.electronAPI.getRecommendedPort();
      setRecommendedPort(port);
      setFormData(prev => ({ ...prev, port }));
      form.setFieldsValue({ port });
    } catch (error) {
      console.error(t('serverCreator.getRecommendedPortFailed'), error);
    }
  };

  const handleTypeChange = (type: ServerType) => {
    setSelectedType(type);
    setFormData(prev => ({ ...prev, type, version: undefined }));
    form.setFieldsValue({ version: undefined });
    setAvailableVersions([]);
  };

  const handleNext = async () => {
    if (currentStep === 0) {
      try {
        await form.validateFields(['name', 'type']);
        const values = form.getFieldsValue(['name', 'type']);
        
        const available = await window.electronAPI.isServerNameAvailable(values.name);
        if (!available) {
          message.error(t('serverCreator.serverNameExists'));
          return;
        }
        
        // 保存第一步的數據
        setFormData(prev => ({
          ...prev,
          name: values.name,
          type: values.type
        }));
        
        setCurrentStep(1);
      } catch (error) {
        // 驗證失敗
      }
    } else if (currentStep === 1) {
      try {
        await form.validateFields(['version', 'port', 'minMemory', 'maxMemory']);
        const values = form.getFieldsValue(['version', 'port', 'minMemory', 'maxMemory', 'javaArgs']);
        
        // 保存第二步的數據
        setFormData(prev => ({
          ...prev,
          version: values.version,
          port: values.port,
          minMemory: values.minMemory,
          maxMemory: values.maxMemory,
          javaArgs: values.javaArgs ? values.javaArgs.split(' ').filter(Boolean) : []
        }));
        
        setCurrentStep(2);
      } catch (error) {
        // 驗證失敗
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCreate = async () => {
    try {
      // 驗證必要的數據是否存在
      if (!formData.name || !formData.type || !formData.version) {
        message.error(t('serverCreator.missingConfigInfo'));
        setCurrentStep(0);
        return;
      }
      
      const config: ServerCreationConfig = {
        name: formData.name!,
        type: formData.type!,
        version: formData.version!,
        port: formData.port || recommendedPort,
        minMemory: formData.minMemory || '1G',
        maxMemory: formData.maxMemory || '2G',
        javaArgs: formData.javaArgs || []
      };

      setLoading(true);
      setCurrentStep(3); // 顯示進度步驟
      
      // 監聽創建進度
      const handleProgress = (progress: CreationProgress) => {
        setCreationProgress(progress);
        if (progress.step === 'completed') {
          message.success(t('serverCreator.creationSuccess'));
          setLoading(false);
        } else if (progress.step === 'error') {
          message.error(t('serverCreator.creationFailed') + `: ${progress.error}`);
          setLoading(false);
        }
      };

      window.electronAPI.onCreationProgress(handleProgress);
      await window.electronAPI.createServer(config);

    } catch (error) {
      message.error(t('serverCreator.createServer'));
      console.error('創建伺服器失敗:', error);
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <Card title={t('serverCreator.basicInfo')}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label={t('serverCreator.serverName')}
                  name="name"
                  rules={[
                    { required: true, message: t('serverCreator.serverNameRequired') },
                    { pattern: /^[a-zA-Z0-9_\-\u4e00-\u9fa5]+$/, message: t('serverCreator.serverNamePattern') }
                  ]}
                >
                  <Input placeholder={t('serverCreator.serverNamePlaceholder')} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label={t('serverCreator.serverType')}
                  name="type"
                  rules={[{ required: true, message: t('serverCreator.serverTypeRequired') }]}
                >
                  <Select 
                    placeholder={t('serverCreator.serverTypePlaceholder')} 
                    onChange={handleTypeChange}
                    dropdownStyle={{ minWidth: '350px' }}
                    style={{ width: '100%' }}
                  >
                    {serverTypes.map(type => (
                      <Select.Option key={type.type} value={type.type}>
                        <div style={{ maxWidth: '300px' }}>
                          <div style={{ fontWeight: 'bold' }}>{type.name}</div>
                          <Text type="secondary" style={{ fontSize: '12px', lineHeight: '1.2', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {type.description}
                          </Text>
                        </div>
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            
            {selectedType && (
              <Row gutter={16}>
                <Col span={24}>
                  <Alert
                    type="info"
                    message={t('serverCreator.serverTypeDescription')}
                    description={
                      serverTypes.find(t => t.type === selectedType)?.description || ''
                    }
                    showIcon
                  />
                </Col>
              </Row>
            )}
          </Card>
        );

      case 1:
        return (
          <Card title={t('serverCreator.versionConfig')}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label={t('serverCreator.minecraftVersion')}
                  name="version"
                  rules={[{ required: true, message: t('serverCreator.minecraftVersionRequired') }]}
                >
                  <Select
                    placeholder={t('serverCreator.minecraftVersionPlaceholder')}
                    loading={loading}
                    disabled={!selectedType}
                    showSearch
                  >
                    {availableVersions.map(version => (
                      <Select.Option key={version.id} value={version.id}>
                        <div>
                          <span>{version.id}</span>
                          {version.stable && (
                            <span style={{ color: '#52c41a', marginLeft: 8 }}>
                              {t('serverCreator.stableVersion')}
                            </span>
                          )}
                        </div>
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label={t('serverCreator.serverPort')}
                  name="port"
                  rules={[
                    { required: true, message: t('serverCreator.serverPortRequired') },
                    { type: 'number', min: 1, max: 65535, message: t('serverCreator.serverPortRange') }
                  ]}
                  initialValue={recommendedPort}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="25565"
                    min={1}
                    max={65535}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Divider orientation="left">{t('serverCreator.memorySettings')}</Divider>
            
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label={t('serverCreator.minMemory')}
                  name="minMemory"
                  rules={[
                    { required: true, message: t('serverCreator.minMemoryRequired') },
                    { pattern: /^\d+(M|G)$/i, message: t('serverCreator.minMemoryPattern') }
                  ]}
                  initialValue="1G"
                >
                  <Input placeholder={t('serverCreator.minMemoryPlaceholder')} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label={t('serverCreator.maxMemory')}
                  name="maxMemory"
                  rules={[
                    { required: true, message: t('serverCreator.maxMemoryRequired') },
                    { pattern: /^\d+(M|G)$/i, message: t('serverCreator.maxMemoryPattern') }
                  ]}
                  initialValue="2G"
                >
                  <Input placeholder={t('serverCreator.maxMemoryPlaceholder')} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={24}>
                <Form.Item
                  label={t('serverCreator.javaArgs')}
                  name="javaArgs"
                >
                  <Input.TextArea
                    placeholder={t('serverCreator.javaArgsPlaceholder')}
                    rows={2}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>
        );

      case 2:
        return (
          <Card title={t('serverCreator.confirmInfo')}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Text strong>{t('serverCreator.serverNameLabel')}</Text>
                  <Text>{formData.name}</Text>
                </Col>
                <Col span={12}>
                  <Text strong>{t('serverCreator.serverTypeLabel')}</Text>
                  <Text>{serverTypes.find(t => t.type === formData.type)?.name}</Text>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Text strong>{t('serverCreator.minecraftVersionLabel')}</Text>
                  <Text>{formData.version}</Text>
                </Col>
                <Col span={12}>
                  <Text strong>{t('serverCreator.portLabel')}</Text>
                  <Text>{formData.port || recommendedPort}</Text>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Text strong>{t('serverCreator.memoryLabel')}</Text>
                  <Text>{formData.minMemory || '1G'} - {formData.maxMemory || '2G'}</Text>
                </Col>
              </Row>
              {formData.javaArgs && formData.javaArgs.length > 0 && (
                <Row gutter={16}>
                  <Col span={24}>
                    <Text strong>{t('serverCreator.javaArgsLabel')}</Text>
                    <Text code>{formData.javaArgs.join(' ')}</Text>
                  </Col>
                </Row>
              )}
              
              <Alert
                type="info"
                message={t('serverCreator.confirmMessage')}
                showIcon
              />
            </Space>
          </Card>
        );

      case 3:
        return (
          <Card title={t('serverCreator.creationProgress')}>
            {creationProgress && (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <div>
                  <Text strong>{t('serverCreator.currentStatus')}</Text>
                  <Text>{creationProgress.message}</Text>
                </div>
                
                <Progress
                  percent={creationProgress.progress}
                  status={creationProgress.step === 'error' ? 'exception' : 
                           creationProgress.step === 'completed' ? 'success' : 'active'}
                />
                
                {creationProgress.step === 'error' && creationProgress.error && (
                  <Alert
                    type="error"
                    message={t('serverCreator.creationFailed')}
                    description={creationProgress.error}
                    showIcon
                  />
                )}
                
                {creationProgress.step === 'completed' && (
                  <Alert
                    type="success"
                    message={t('serverCreator.creationSuccess')}
                    description={t('serverCreator.creationSuccessDescription')}
                    showIcon
                  />
                )}
              </Space>
            )}
          </Card>
        );

      default:
        return null;
    }
  };

  const getStepStatus = (step: number) => {
    if (step < currentStep) return 'finish';
    if (step === currentStep) return 'process';
    return 'wait';
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Title level={2}>
        <DatabaseOutlined /> {t('serverCreator.title')}
      </Title>

      <Steps current={currentStep} style={{ marginBottom: '32px' }}>
        <Step
          title={t('serverCreator.basicInfo')}
          icon={<DatabaseOutlined />}
          status={getStepStatus(0)}
        />
        <Step
          title={t('serverCreator.versionConfig')}
          icon={<SettingOutlined />}
          status={getStepStatus(1)}
        />
        <Step
          title={t('serverCreator.confirmInfo')}
          icon={<CheckCircleOutlined />}
          status={getStepStatus(2)}
        />
        <Step
          title={t('serverCreator.creationProgress')}
          icon={loading ? <LoadingOutlined /> : <CheckCircleOutlined />}
          status={getStepStatus(3)}
        />
      </Steps>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleCreate}
        initialValues={{
          minMemory: '1G',
          maxMemory: '2G',
          port: recommendedPort
        }}
      >
        {renderStepContent()}

        <div style={{ marginTop: '24px', textAlign: 'right' }}>
          <Space>
            {currentStep > 0 && currentStep < 3 && (
              <Button onClick={handlePrevious}>
                {t('serverCreator.previousStep')}
              </Button>
            )}
            
            {currentStep < 2 && (
              <Button type="primary" onClick={handleNext}>
                {t('serverCreator.nextStep')}
              </Button>
            )}
            
            {currentStep === 2 && (
              <Button
                type="primary"
                onClick={handleCreate}
                loading={loading}
              >
                {t('serverCreator.createServer')}
              </Button>
            )}
            
            {currentStep === 3 && creationProgress?.step === 'completed' && (
              <Button
                type="primary"
                onClick={() => navigate('/')}
              >
                {t('serverCreator.returnHome')}
              </Button>
            )}
          </Space>
        </div>
      </Form>
    </div>
  );
};