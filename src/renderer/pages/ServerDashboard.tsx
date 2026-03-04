import React, { useState, useEffect } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Button, 
  Space, 
  Typography, 
  Statistic, 
  Tag,
  message,
  Modal,
  List,
  Avatar,
  Input,
  InputNumber,
  Select
} from 'antd';
import {
  PlayCircleOutlined,
  StopOutlined,
  CodeOutlined,
  SettingOutlined,
  FolderOpenOutlined,
  UserOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  ReloadOutlined,
  PlusOutlined,
  FolderOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useServerStore } from '../store/serverStore';
import { useI18n } from '../hooks/useI18n';
import type { ServerInfo, ServerType, ServerTypeInfo, AvailableVersion, ServerCreationConfig, CreationProgress } from '@shared/types';

const { Title, Text, Paragraph } = Typography;

export const ServerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { servers, setServers, setCurrentServer } = useServerStore();
  const { t } = useI18n();
  const [selectedServer, setSelectedServer] = useState<ServerInfo | null>(null);
  const [operationLoading, setOperationLoading] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentServerPath, setCurrentServerPath] = useState<string>('');
  const [pathSelectionLoading, setPathSelectionLoading] = useState(false);

  // 載入保存的自訂路徑
  useEffect(() => {
    const loadCustomPath = async () => {
      try {
        const settings = await window.electronAPI.loadSettings();
        if (settings.customServerPath) {
          setCurrentServerPath(settings.customServerPath);
          // 從保存的路徑載入伺服器
          const serversFromPath = await window.electronAPI.getServerListFromPath(settings.customServerPath);
          setServers(serversFromPath);
        }
      } catch (error) {
        console.error('載入自訂路徑失敗:', error);
      }
    };
    
    loadCustomPath();
  }, [setServers]);
  
  // 伺服器創建相關狀態
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [creationLoading, setCreationLoading] = useState(false);
  const [serverTypes, setServerTypes] = useState<ServerTypeInfo[]>([]);
  const [availableVersions, setAvailableVersions] = useState<AvailableVersion[]>([]);
  const [selectedType, setSelectedType] = useState<ServerType | null>(null);
  const [creationProgress, setCreationProgress] = useState<CreationProgress | null>(null);
  const [recommendedPort, setRecommendedPort] = useState<number>(25565);
  const [formData, setFormData] = useState<Partial<ServerCreationConfig>>({
    minMemory: '1G',
    maxMemory: '2G',
    javaArgs: []
  });

  const runningServers = servers.filter(server => server.status === 'running');
  const stoppedServers = servers.filter(server => server.status === 'stopped');
  const totalPlayers = runningServers.reduce((total, server) => total + (server.playerCount || 0), 0);

  const getStatusColor = (status: ServerInfo['status']) => {
    switch (status) {
      case 'running': return 'green';
      case 'starting': return 'orange';
      case 'stopping': return 'orange';
      case 'stopped': return 'red';
      default: return 'default';
    }
  };

  const getStatusText = (status: ServerInfo['status']) => {
    switch (status) {
      case 'running': return t('server.status.running');
      case 'starting': return t('server.status.starting');
      case 'stopping': return t('server.status.stopping');
      case 'stopped': return t('server.status.stopped');
      default: return t('common.unknown');
    }
  };

  const handleServerAction = async (server: ServerInfo, action: 'start' | 'stop') => {
    setOperationLoading(`${server.id}-${action}`);
    
    try {
      if (action === 'start') {
        await window.electronAPI.startServer(server.id);
        message.success(t('success.serverStarting', { name: server.name }));
      } else {
        await window.electronAPI.stopServer(server.id);
        message.success(t('success.serverStopping', { name: server.name }));
      }
    } catch (error: any) {
      message.error(t('errors.operationFailed', { 
        error: error.message || t('errors.unknownError') 
      }));
    } finally {
      setOperationLoading(null);
    }
  };

  const handleOpenConsole = (server: ServerInfo) => {
    setCurrentServer(server.id);
    navigate(`/console/${server.id}`);
  };

  const handleOpenSettings = (server: ServerInfo) => {
    setCurrentServer(server.id);
    navigate(`/settings/${server.id}`);
  };

  const handleOpenDirectory = async (server: ServerInfo) => {
    try {
      await window.electronAPI.openDirectory(server.path);
    } catch (error: any) {
      message.error(`無法開啟目錄: ${error.message || '未知錯誤'}`);
    }
  };

  const handleDeleteServer = async (server: ServerInfo) => {
    try {
      // 獲取當前設定（這裡應該從設定存儲中獲取）
      const deleteOptions = {
        deleteBackups: true, // 預設刪除備份
        deleteLogs: false,   // 預設不刪除日誌
      };

      // 確認刪除
      Modal.confirm({
        title: '確認刪除伺服器',
        content: (
          <div>
            <p>確定要刪除伺服器 "{server.name}" 嗎？此操作無法恢復。</p>
            <p style={{ fontSize: '12px', color: '#cccccc', marginTop: '8px' }}>
              將會刪除伺服器目錄{deleteOptions.deleteBackups ? '及備份檔案' : ''}{deleteOptions.deleteLogs ? '和日誌檔案' : ''}。
            </p>
          </div>
        ),
        okText: '確認刪除',
        okType: 'danger',
        cancelText: '取消',
        onOk: async () => {
          try {
            await window.electronAPI.deleteServer(server.id, deleteOptions);
            message.success(`伺服器 "${server.name}" 已成功刪除`);
            // 重新載入伺服器列表
            const updatedServers = await window.electronAPI.getServerList();
            useServerStore.getState().setServers(updatedServers);
          } catch (error: any) {
            message.error(`刪除伺服器失敗: ${error.message || '未知錯誤'}`);
          }
        }
      });
    } catch (error: any) {
      message.error(`刪除操作失敗: ${error.message || '未知錯誤'}`);
    }
  };

  const formatUptime = (lastStart?: Date) => {
    if (!lastStart) return '-';
    
    const now = new Date();
    const diff = now.getTime() - new Date(lastStart).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}${t('common.hours')} ${minutes}${t('common.minutes')}`;
    }
    return `${minutes}${t('common.minutes')}`;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      let updatedServers;
      if (currentServerPath) {
        // 檢查方法是否可用
        if (typeof window.electronAPI.getServerListFromPath !== 'function') {
          throw new Error('getServerListFromPath 方法不可用，請重啟應用程式');
        }
        
        // 從當前選定的路徑刷新
        updatedServers = await window.electronAPI.getServerListFromPath(currentServerPath);
        message.success(`已從路徑刷新 ${updatedServers.length} 個伺服器`);
      } else {
        // 從預設路徑刷新
        updatedServers = await window.electronAPI.getServerList();
        message.success('伺服器列表已刷新');
      }
      setServers(updatedServers);
    } catch (error: any) {
      console.error(t('errors.refreshFailed'), error);
      message.error(t('errors.refreshFailed', { error: error.message || t('errors.unknownError') }));
    } finally {
      setRefreshing(false);
    }
  };

  const handleSelectPath = async () => {
    setPathSelectionLoading(true);
    try {
      const selectedPath = await window.electronAPI.selectDirectory();
      if (selectedPath) {
        setCurrentServerPath(selectedPath);
        
        // 檢查方法是否可用
        if (typeof window.electronAPI.getServerListFromPath !== 'function') {
          throw new Error('getServerListFromPath 方法不可用，請重啟應用程式');
        }
        
        // 從選定的路徑掃描伺服器
        const serversFromPath = await window.electronAPI.getServerListFromPath(selectedPath);
        setServers(serversFromPath);
        
        // 保存選擇的路徑到設定
        const currentSettings = await window.electronAPI.loadSettings();
        await window.electronAPI.saveSettings({
          ...currentSettings,
          customServerPath: selectedPath
        });
        
        message.success(t('success.serversLoadedFromPath', { count: serversFromPath.length, path: selectedPath }));
      }
    } catch (error: any) {
      console.error(t('errors.selectPathFailed'), error);
      message.error(t('errors.selectPathFailed', { error: error.message || t('errors.unknownError') }));
    } finally {
      setPathSelectionLoading(false);
    }
  };

  // 伺服器創建相關函數
  const loadServerTypes = async () => {
    try {
      const types = await window.electronAPI.getServerTypes();
      setServerTypes(types);
    } catch (error) {
      message.error('載入伺服器類型失敗');
      console.error('載入伺服器類型失敗:', error);
    }
  };

  const loadAvailableVersions = async (type: ServerType) => {
    setCreationLoading(true);
    try {
      const versions = await window.electronAPI.getAvailableVersions(type);
      setAvailableVersions(versions);
    } catch (error) {
      message.error(`載入 ${type} 版本列表失敗`);
      console.error('載入版本列表失敗:', error);
    } finally {
      setCreationLoading(false);
    }
  };

  const loadRecommendedPort = async () => {
    try {
      const port = await window.electronAPI.getRecommendedPort();
      setRecommendedPort(port);
      setFormData(prev => ({ ...prev, port }));
    } catch (error) {
      console.error('獲取推薦端口失敗:', error);
    }
  };

  const handleTypeChange = (type: ServerType) => {
    setSelectedType(type);
    setFormData(prev => ({ ...prev, type, version: undefined }));
    loadAvailableVersions(type);
  };

  const handleCreateServer = async () => {
    try {
      // 驗證必要的數據是否存在
      if (!formData.name || !formData.type || !formData.version) {
        message.error('缺少必要的配置信息，請填寫伺服器名稱、類型和版本');
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

      setCreationLoading(true);
      
      // 監聽創建進度
      const handleProgress = (progress: CreationProgress) => {
        setCreationProgress(progress);
        if (progress.step === 'completed') {
          message.success('伺服器創建完成！');
          setCreationLoading(false);
          setCreateModalVisible(false);
          handleRefresh(); // 刷新伺服器列表
        } else if (progress.step === 'error') {
          message.error(`創建失敗: ${progress.error}`);
          setCreationLoading(false);
        }
      };

      window.electronAPI.onCreationProgress(handleProgress);
      await window.electronAPI.createServer(config);

    } catch (error) {
      message.error('創建伺服器失敗');
      console.error('創建伺服器失敗:', error);
      setCreationLoading(false);
    }
  };

  const openCreateModal = async () => {
    setCreateModalVisible(true);
    await loadServerTypes();
    await loadRecommendedPort();
  };

  return (
    <div className="p-6">
      {/* 統計概覽 */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title={t('dashboard.totalServers')}
              value={servers.length}
              prefix={<CodeOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title={t('dashboard.runningServers')}
              value={runningServers.length}
              valueStyle={{ color: '#52c41a' }}
              prefix={<PlayCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title={t('dashboard.stoppedServers')}
              value={stoppedServers.length}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<StopOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title={t('dashboard.onlinePlayers')}
              value={totalPlayers}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 伺服器列表 */}
      <Card 
        title={
          <div className="flex justify-between items-center">
            <div>
              <div>{t('dashboard.serverList')}</div>
              <div className="text-xs text-gray-400 mt-1">
                {t('dashboard.currentPath')}: {currentServerPath}
              </div>
            </div>
            <Space>
              <Button 
                icon={<FolderOutlined />}
                onClick={handleSelectPath}
                loading={pathSelectionLoading}
                size="small"
                title="選擇伺服器路徑"
              >
                {t('dashboard.selectPath')}
              </Button>
              <Button 
                icon={<PlusOutlined />}
                onClick={openCreateModal}
                size="small"
                type="primary"
              >
                {t('dashboard.createServer')}
              </Button>
              <Button 
                icon={<ReloadOutlined />}
                loading={refreshing}
                onClick={handleRefresh}
                size="small"
              >
                {t('dashboard.refresh')}
              </Button>
            </Space>
          </div>
        }
        className="mb-6"
      >
        {servers.length === 0 ? (
          <div className="text-center py-12">
            <CodeOutlined className="text-6xl text-gray-400 mb-4" />
            <Title level={4} className="text-gray-400">{t('dashboard.noServersFound')}</Title>
            <Paragraph className="text-gray-500">
              {t('dashboard.noServersDescription')}
            </Paragraph>
            <Button type="primary" onClick={() => navigate('/app-settings')}>
              {t('dashboard.goToSettings')}
            </Button>
          </div>
        ) : (
          <List
            grid={{
              gutter: 16,
              xs: 1,
              sm: 1,
              md: 2,
              lg: 2,
              xl: 3,
              xxl: 3,
            }}
            dataSource={servers}
            renderItem={(server) => (
              <List.Item>
                <Card
                  hoverable
                  className={`server-card ${selectedServer?.id === server.id ? 'active' : ''}`}
                  onClick={() => setSelectedServer(server)}
                  actions={[
                    <Button
                      key="console"
                      type="text"
                      icon={<CodeOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenConsole(server);
                      }}
                    >
                      {t('dashboard.console')}
                    </Button>,
                    <Button
                      key="settings"
                      type="text"
                      icon={<SettingOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenSettings(server);
                      }}
                    >
                      {t('dashboard.settings')}
                    </Button>,
                    <Button
                      key="folder"
                      type="text"
                      icon={<FolderOpenOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDirectory(server);
                      }}
                    >
                      {t('dashboard.directory')}
                    </Button>,
                    <Button
                      key="delete"
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteServer(server);
                      }}
                    >
                      {t('dashboard.delete')}
                    </Button>,
                  ]}
                >
                  <Card.Meta
                    avatar={
                      <Avatar
                        size={48}
                        className={`status-${server.status}`}
                        style={{
                          backgroundColor: server.status === 'running' ? '#52c41a' :
                                         server.status === 'starting' || server.status === 'stopping' ? '#faad14' :
                                         '#ff4d4f'
                        }}
                      >
                        {server.name.charAt(0).toUpperCase()}
                      </Avatar>
                    }
                    title={
                      <Space>
                        <Text strong>{server.name}</Text>
                        <Tag color={getStatusColor(server.status)}>
                          {getStatusText(server.status)}
                        </Tag>
                      </Space>
                    }
                    description={
                      <div>
                        <div className="mb-2">
                          <Text type="secondary">{t('dashboard.version')}: {server.version}</Text>
                        </div>
                        {server.status === 'running' && (
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <Text type="secondary">玩家:</Text>
                              <Text>{server.playerCount || 0}/{server.maxPlayers || 20}</Text>
                            </div>
                            <div className="flex justify-between">
                              <Text type="secondary">運行時間:</Text>
                              <Text>{formatUptime(server.lastStart)}</Text>
                            </div>
                          </div>
                        )}
                        {server.lastStart && server.status !== 'running' && (
                          <div className="flex items-center mt-2 text-gray-400">
                            <ClockCircleOutlined className="mr-1" />
                            <Text type="secondary" className="text-xs">
                              {t('players.lastSeen')}: {new Date(server.lastStart).toLocaleString()}
                            </Text>
                          </div>
                        )}
                      </div>
                    }
                  />
                  
                  <div className="mt-4 flex justify-between">
                    {server.status === 'stopped' ? (
                      <Button
                        type="primary"
                        icon={<PlayCircleOutlined />}
                        loading={operationLoading === `${server.id}-start`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleServerAction(server, 'start');
                        }}
                      >
                        {t('dashboard.startServer')}
                      </Button>
                    ) : (
                      <Button
                        danger
                        icon={<StopOutlined />}
                        loading={operationLoading === `${server.id}-stop`}
                        disabled={server.status === 'starting' || server.status === 'stopping'}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleServerAction(server, 'stop');
                        }}
                      >
                        {t('dashboard.stopServer')}
                      </Button>
                    )}
                  </div>
                </Card>
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* 創建伺服器模態框 */}
      <Modal
        title={t('dashboard.createNewServer')}
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setCreateModalVisible(false)}>
            取消
          </Button>,
          <Button 
            key="create" 
            type="primary" 
            loading={creationLoading}
            onClick={handleCreateServer}
          >
            {t('dashboard.createServerButton')}
          </Button>
        ]}
        width={600}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">{t('dashboard.serverNameLabel')}</label>
            <Input
              placeholder={t('dashboard.serverNamePlaceholder')}
              value={formData.name || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t('dashboard.serverTypeLabel')}</label>
            <Select
              placeholder={t('dashboard.serverTypePlaceholder')}
              style={{ width: '100%' }}
              value={selectedType}
              onChange={handleTypeChange}
              loading={creationLoading}
            >
              {serverTypes.map(type => (
                <Select.Option key={type.type} value={type.type}>
                  {type.name}
                </Select.Option>
              ))}
            </Select>
          </div>

          {selectedType && (
            <div>
              <label className="block text-sm font-medium mb-2">{t('dashboard.versionLabel')}</label>
              <Select
                placeholder={t('dashboard.versionPlaceholder')}
                style={{ width: '100%' }}
                value={formData.version}
                onChange={(version) => setFormData(prev => ({ ...prev, version }))}
                loading={creationLoading}
              >
                {availableVersions.map(version => (
                  <Select.Option key={version.id} value={version.id}>
                    {version.name}
                  </Select.Option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">{t('dashboard.portLabel')}</label>
            <InputNumber
              style={{ width: '100%' }}
              placeholder={t('dashboard.portPlaceholder')}
              value={formData.port || recommendedPort}
              onChange={(port) => setFormData(prev => ({ ...prev, port: port || recommendedPort }))}
              min={1}
              max={65535}
            />
          </div>

          <Row gutter={16}>
            <Col span={12}>
              <label className="block text-sm font-medium mb-2">{t('dashboard.minMemoryLabel')}</label>
              <Input
                placeholder={t('dashboard.minMemoryPlaceholder')}
                value={formData.minMemory || '1G'}
                onChange={(e) => setFormData(prev => ({ ...prev, minMemory: e.target.value }))}
              />
            </Col>
            <Col span={12}>
              <label className="block text-sm font-medium mb-2">{t('dashboard.maxMemoryLabel')}</label>
              <Input
                placeholder={t('dashboard.maxMemoryPlaceholder')}
                value={formData.maxMemory || '2G'}
                onChange={(e) => setFormData(prev => ({ ...prev, maxMemory: e.target.value }))}
              />
            </Col>
          </Row>

          {creationProgress && (
            <div>
              <label className="block text-sm font-medium mb-2">{t('dashboard.creationProgressLabel')}</label>
              <div className="text-sm text-gray-600">
                {creationProgress.message}
                {creationProgress.percentage && ` (${creationProgress.percentage}%)`}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};