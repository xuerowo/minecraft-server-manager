import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card, 
  Typography, 
  Empty, 
  Tabs, 
  Table, 
  Button, 
  Space, 
  Modal, 
  Input, 
  Checkbox, 
  message, 
  Tag, 
  Progress, 
  Popconfirm,
  Tooltip,
  Alert,
  Spin
} from 'antd';
import {
  FolderOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  UploadOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  SwapOutlined,
  ImportOutlined,
  EditOutlined
} from '@ant-design/icons';
import { useServerStore } from '../store/serverStore';
import { useI18n } from '../hooks/useI18n';
import type { WorldInfo, BackupInfo } from '../types/global';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

interface CreateBackupModalProps {
  visible: boolean;
  worlds: WorldInfo[];
  onOk: (backupName: string, selectedWorlds: string[]) => Promise<void>;
  onCancel: () => void;
}

const CreateBackupModal: React.FC<CreateBackupModalProps> = ({ 
  visible, 
  worlds, 
  onOk, 
  onCancel 
}) => {
  const { t } = useI18n();
  const [backupName, setBackupName] = useState('');
  const [selectedWorlds, setSelectedWorlds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleOk = async () => {
    if (!backupName.trim()) {
      message.error(t('maps.enterBackupName'));
      return;
    }
    if (selectedWorlds.length === 0) {
      message.error(t('maps.selectAtLeastOneWorld'));
      return;
    }

    setLoading(true);
    try {
      await onOk(backupName.trim(), selectedWorlds);
      setBackupName('');
      setSelectedWorlds([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setBackupName('');
    setSelectedWorlds([]);
    onCancel();
  };

  return (
    <Modal
      title={t('maps.createBackupTitle')}
      visible={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={loading}
      width={600}
    >
      <div className="space-y-4">
        <div>
          <Text strong>{t('maps.backupNameLabel')}</Text>
          <Input
            value={backupName}
            onChange={(e) => setBackupName(e.target.value)}
            placeholder={t('maps.backupNamePlaceholder')}
            className="mt-2"
          />
        </div>
        
        <div>
          <Text strong>{t('maps.selectWorldsLabel')}</Text>
          <div className="mt-2 space-y-2">
            {worlds.map(world => (
              <div key={world.name} className="flex items-center">
                <Checkbox
                  checked={selectedWorlds.includes(world.name)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedWorlds([...selectedWorlds, world.name]);
                    } else {
                      setSelectedWorlds(selectedWorlds.filter(w => w !== world.name));
                    }
                  }}
                >
                  <Space>
                    <FolderOutlined />
                    <span>{world.name}</span>
                    <Tag color={getWorldTypeColor(world.type)}>{getWorldTypeName(world.type, t)}</Tag>
                    <Text type="secondary">({formatFileSize(world.size)})</Text>
                    {!world.hasLevelData && (
                      <Tooltip title={t('maps.missingLevelDat')}>
                        <WarningOutlined className="text-orange-400" />
                      </Tooltip>
                    )}
                  </Space>
                </Checkbox>
              </div>
            ))}
          </div>
        </div>
        
        <Alert
          message={t('maps.backupTipTitle')}
          description={t('maps.backupTipDescription')}
          type="info"
          showIcon
        />
      </div>
    </Modal>
  );
};

interface ReplaceWorldModalProps {
  visible: boolean;
  worldName: string;
  onOk: (sourcePath: string) => Promise<void>;
  onCancel: () => void;
}

const ReplaceWorldModal: React.FC<ReplaceWorldModalProps> = ({ 
  visible, 
  worldName,
  onOk, 
  onCancel 
}) => {
  const { t } = useI18n();
  const [sourcePath, setSourcePath] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSelectFolder = async () => {
    try {
      const selectedPath = await window.electronAPI.selectWorldFolder();
      if (selectedPath) {
        setSourcePath(selectedPath);
      }
    } catch (error: any) {
      message.error(t('maps.selectFolderFailed', { error: error.message }));
    }
  };

  const handleOk = async () => {
    if (!sourcePath.trim()) {
      message.error(t('maps.selectWorldFolder'));
      return;
    }

    setLoading(true);
    try {
      await onOk(sourcePath.trim());
      setSourcePath('');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setSourcePath('');
    onCancel();
  };

  return (
    <Modal
      title={t('maps.replaceMapTitle')}
      visible={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={loading}
      width={600}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
    >
      <div className="space-y-4">
        <Alert
          message={t('maps.importantNotice')}
          description={t('maps.replaceWarning', { worldName })}
          type="warning"
          showIcon
          className="mb-4"
        />
        
        <div>
          <Text strong>{t('maps.worldToReplace')}</Text>
          <div className="mt-2 p-3 bg-gray-700 dark:bg-gray-700 rounded border border-gray-600">
            <Space>
              <FolderOutlined className="text-blue-400" />
              <Text className="text-white">{worldName}</Text>
            </Space>
          </div>
        </div>
        
        <div>
          <Text strong>{t('maps.newWorldFolder')}</Text>
          <div className="mt-2 flex gap-2">
            <Input
              value={sourcePath}
              onChange={(e) => setSourcePath(e.target.value)}
              placeholder={t('maps.newWorldFolder') + '...'}
              className="flex-1"
            />
            <Button
              icon={<ImportOutlined />}
              onClick={handleSelectFolder}
            >
              {t('maps.browse')}
            </Button>
          </div>
        </div>
        
        <Alert
          message={t('maps.operationInstructions')}
          description={
            <div>
              <p>1. {t('maps.ensureServerStopped')}</p>
              <p>2. {t('maps.selectWorldFolderWithLevelDat')}</p>
              <p>3. {t('maps.newWorldUsesFolderName')}</p>
              <p>4. {t('maps.mainWorldAutoUpdate')}</p>
              <p>5. {t('maps.recommendBackupBeforeReplace')}</p>
            </div>
          }
          type="info"
          showIcon
        />
      </div>
    </Modal>
  );
};

interface RenameWorldModalProps {
  visible: boolean;
  worldName: string;
  onOk: (newWorldName: string) => Promise<void>;
  onCancel: () => void;
}

const RenameWorldModal: React.FC<RenameWorldModalProps> = ({ 
  visible, 
  worldName,
  onOk, 
  onCancel 
}) => {
  const { t } = useI18n();
  const [newWorldName, setNewWorldName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setNewWorldName(worldName);
    }
  }, [visible, worldName]);

  const handleOk = async () => {
    const trimmedName = newWorldName.trim();
    
    if (!trimmedName) {
      message.error(t('maps.worldNameEmpty'));
      return;
    }

    if (trimmedName === worldName) {
      message.warning(t('maps.sameNameWarning'));
      return;
    }

    // Validate name format
    const namePattern = /^[a-zA-Z0-9_\-\u4e00-\u9fa5]+$/;
    if (!namePattern.test(trimmedName)) {
      message.error(t('maps.invalidNameFormat'));
      return;
    }

    setLoading(true);
    try {
      await onOk(trimmedName);
      setNewWorldName('');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setNewWorldName('');
    onCancel();
  };

  return (
    <Modal
      title={t('maps.renameWorldTitle')}
      visible={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={loading}
      width={500}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
    >
      <div className="space-y-4">
        <div>
          <Text strong>{t('maps.originalWorldName')}</Text>
          <div className="mt-2 p-3 bg-gray-700 dark:bg-gray-700 rounded border border-gray-600">
            <Space>
              <FolderOutlined className="text-blue-400" />
              <Text className="text-white">{worldName}</Text>
            </Space>
          </div>
        </div>
        
        <div>
          <Text strong>{t('maps.newWorldName')}</Text>
          <Input
            value={newWorldName}
            onChange={(e) => setNewWorldName(e.target.value)}
            placeholder={t('maps.newWorldNamePlaceholder')}
            className="mt-2"
            onPressEnter={handleOk}
            maxLength={50}
          />
        </div>
        
        <Alert
          message={t('maps.renameInstructions')}
          description={
            <div>
              <p>• {t('maps.invalidNameFormat')}</p>
              <p>• {t('maps.mainWorldAutoUpdate')}</p>
              <p>• {t('maps.stopServerFirst')}</p>
            </div>
          }
          type="info"
          showIcon
        />
      </div>
    </Modal>
  );
};

const getWorldTypeColor = (type: WorldInfo['type']) => {
  switch (type) {
    case 'overworld': return 'green';
    case 'nether': return 'red';
    case 'end': return 'purple';
    default: return 'blue';
  }
};

const getWorldTypeName = (type: WorldInfo['type'], t: any) => {
  switch (type) {
    case 'overworld': return t('maps.worldTypeOverworld');
    case 'nether': return t('maps.worldTypeNether');
    case 'end': return t('maps.worldTypeEnd');
    default: return t('maps.worldTypeCustom');
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const MapManager: React.FC = () => {
  const { serverId } = useParams<{ serverId: string }>();
  const { servers } = useServerStore();
  const { t } = useI18n();
  const server = serverId ? servers.find(s => s.id === serverId) : null;
  
  const [worlds, setWorlds] = useState<WorldInfo[]>([]);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [createBackupVisible, setCreateBackupVisible] = useState(false);
  const [replaceWorldVisible, setReplaceWorldVisible] = useState(false);
  const [selectedWorldForReplace, setSelectedWorldForReplace] = useState<string>('world');
  const [renameWorldVisible, setRenameWorldVisible] = useState(false);
  const [selectedWorldForRename, setSelectedWorldForRename] = useState<string>('');
  const [activeTab, setActiveTab] = useState('worlds');

  const loadWorlds = async () => {
    if (!serverId) return;
    
    setLoading(true);
    try {
      const worldList = await window.electronAPI.getWorldInfo(serverId);
      setWorlds(worldList);
    } catch (error: any) {
      message.error(t('maps.loadWorldInfoFailed', { error: error.message }));
    } finally {
      setLoading(false);
    }
  };

  const loadBackups = async () => {
    if (!serverId) return;
    
    setLoading(true);
    try {
      const backupList = await window.electronAPI.getBackups(serverId);
      setBackups(backupList);
    } catch (error: any) {
      message.error(t('maps.loadBackupsFailed', { error: error.message }));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async (backupName: string, selectedWorlds: string[]) => {
    if (!serverId) return;
    
    try {
      await window.electronAPI.createBackup(serverId, backupName, selectedWorlds);
      message.success(t('maps.backupCreatedSuccess'));
      setCreateBackupVisible(false);
      loadBackups();
    } catch (error: any) {
      message.error(t('maps.createBackupFailed', { error: error.message }));
    }
  };

  const handleRestoreBackup = async (backupFileName: string) => {
    if (!serverId || !server) return;
    
    if (server.status === 'running') {
      message.warning(t('maps.stopServerFirst'));
      return;
    }

    Modal.confirm({
      title: t('maps.confirmRestoreTitle'),
      content: (
        <div>
          <p>{t('maps.confirmRestoreContent', { fileName: backupFileName })}</p>
        </div>
      ),
      icon: <ExclamationCircleOutlined />,
      okText: t('maps.confirmRestore'),
      okType: 'danger',
      cancelText: t('common.cancel'),
      async onOk() {
        try {
          await window.electronAPI.restoreBackup(serverId!, backupFileName);
          message.success(t('maps.backupRestoredSuccess'));
          loadWorlds();
        } catch (error: any) {
          message.error(t('maps.restoreBackupFailed', { error: error.message }));
        }
      }
    });
  };

  const handleDeleteBackup = async (backupFileName: string) => {
    if (!serverId) return;
    
    try {
      await window.electronAPI.deleteBackup(serverId, backupFileName);
      message.success(t('maps.backupDeletedSuccess'));
      loadBackups();
    } catch (error: any) {
      message.error(t('maps.deleteBackupFailed', { error: error.message }));
    }
  };


  const handleReplaceWorld = async (worldName: string) => {
    if (!serverId || !server) return;
    
    if (server.status === 'running') {
      message.warning(t('maps.stopServerFirst'));
      return;
    }

    setSelectedWorldForReplace(worldName);
    setReplaceWorldVisible(true);
  };

  const handleConfirmReplaceWorld = async (sourcePath: string) => {
    if (!serverId) return;
    
    try {
      const result = await window.electronAPI.replaceWorld(serverId, sourcePath, selectedWorldForReplace);
      message.success(t('maps.mapReplacedSuccess', { newWorldName: result.newWorldName }));
      setReplaceWorldVisible(false);
      loadWorlds();
    } catch (error: any) {
      message.error(t('maps.replaceMapFailed', { error: error.message }));
    }
  };

  const handleRenameWorld = async (worldName: string) => {
    if (!serverId || !server) return;
    
    if (server.status === 'running') {
      message.warning(t('maps.stopServerFirst'));
      return;
    }

    setSelectedWorldForRename(worldName);
    setRenameWorldVisible(true);
  };

  const handleConfirmRenameWorld = async (newWorldName: string) => {
    if (!serverId) return;
    
    try {
      await window.electronAPI.renameWorld(serverId, selectedWorldForRename, newWorldName);
      message.success(t('maps.worldRenamedSuccess'));
      setRenameWorldVisible(false);
      loadWorlds();
    } catch (error: any) {
      message.error(t('maps.renameWorldFailed', { error: error.message }));
    }
  };

  const handleRefresh = () => {
    if (activeTab === 'worlds') {
      loadWorlds();
    } else {
      loadBackups();
    }
  };

  useEffect(() => {
    loadWorlds();
    loadBackups();
  }, [serverId]);

  if (!server) {
    return (
      <div className="p-6">
        <Card>
          <Empty
            description={t('maps.selectServerFirst')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      </div>
    );
  }

  const worldColumns = [
    {
      title: t('maps.worldName'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: WorldInfo) => (
        <Space>
          <FolderOutlined />
          <span>{name}</span>
          {!record.hasLevelData && (
            <Tooltip title={t('maps.missingLevelDat')}>
              <WarningOutlined className="text-orange-400" />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: t('maps.type'),
      dataIndex: 'type',
      key: 'type',
      render: (type: WorldInfo['type']) => (
        <Tag color={getWorldTypeColor(type)}>{getWorldTypeName(type, t)}</Tag>
      ),
    },
    {
      title: t('maps.size'),
      dataIndex: 'size',
      key: 'size',
      render: (size: number) => formatFileSize(size),
      sorter: (a: WorldInfo, b: WorldInfo) => a.size - b.size,
    },
    {
      title: t('maps.lastModified'),
      dataIndex: 'lastModified',
      key: 'lastModified',
      render: (date: Date) => new Date(date).toLocaleString(),
      sorter: (a: WorldInfo, b: WorldInfo) => 
        new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime(),
    },
    {
      title: t('maps.actions'),
      key: 'actions',
      render: (_: any, record: WorldInfo) => (
        <Space>
          <Button
            size="small"
            icon={<FolderOutlined />}
            onClick={() => window.electronAPI.openDirectory(record.path)}
          >
            {t('maps.openFolder')}
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleRenameWorld(record.name)}
            disabled={server.status === 'running'}
          >
            {t('maps.rename')}
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<SwapOutlined />}
            onClick={() => handleReplaceWorld(record.name)}
            disabled={server.status === 'running'}
          >
            {t('maps.replaceMap')}
          </Button>
        </Space>
      ),
    },
  ];

  const backupColumns = [
    {
      title: t('maps.backupName'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Space>
          <DatabaseOutlined />
          <span>{name}</span>
        </Space>
      ),
    },
    {
      title: t('maps.fileName'),
      dataIndex: 'fileName',
      key: 'fileName',
      render: (fileName: string) => (
        <Text code className="text-xs">{fileName}</Text>
      ),
    },
    {
      title: t('maps.size'),
      dataIndex: 'size',
      key: 'size',
      render: (size: number) => formatFileSize(size),
      sorter: (a: BackupInfo, b: BackupInfo) => a.size - b.size,
    },
    {
      title: t('maps.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: Date) => new Date(date).toLocaleString(),
      sorter: (a: BackupInfo, b: BackupInfo) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: t('maps.actions'),
      key: 'actions',
      render: (_: any, record: BackupInfo) => (
        <Space>
          <Button
            size="small"
            type="primary"
            icon={<UploadOutlined />}
            onClick={() => handleRestoreBackup(record.fileName)}
            disabled={server.status === 'running'}
          >
            {t('maps.restore')}
          </Button>
          <Popconfirm
            title={t('maps.confirmDelete')}
            onConfirm={() => handleDeleteBackup(record.fileName)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
            okType="danger"
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              {t('common.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <Title level={3} className="!text-white !mb-0">
          {server.name} - {t('maps.title')}
        </Title>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={loading}
          >
            {t('maps.refresh')}
          </Button>
          {server.status !== 'running' && (
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => setCreateBackupVisible(true)}
              disabled={worlds.length === 0}
            >
              {t('maps.createBackup')}
            </Button>
          )}
        </Space>
      </div>

      {server.status === 'running' && (
        <Alert
          message={t('maps.serverRunning')}
          description={t('maps.serverRunningDescription')}
          type="info"
          showIcon
          className="mb-4"
        />
      )}

      <Card className="flex-1">
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          tabBarStyle={{ marginBottom: 24 }}
        >
          <TabPane 
            tab={
              <span>
                <FolderOutlined />
                {t('maps.worldFiles')} ({worlds.length})
              </span>
            } 
            key="worlds"
          >
            <Spin spinning={loading && activeTab === 'worlds'}>
              <Table
                columns={worldColumns}
                dataSource={worlds}
                rowKey="name"
                pagination={{ pageSize: 10 }}
                locale={{
                  emptyText: (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={t('maps.noWorldsFound')}
                    />
                  )
                }}
              />
            </Spin>
          </TabPane>
          
          <TabPane 
            tab={
              <span>
                <DatabaseOutlined />
                {t('maps.backupFiles')} ({backups.length})
              </span>
            } 
            key="backups"
          >
            <Spin spinning={loading && activeTab === 'backups'}>
              <Table
                columns={backupColumns}
                dataSource={backups}
                rowKey="fileName"
                pagination={{ pageSize: 10 }}
                locale={{
                  emptyText: (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={t('maps.noBackupsFound')}
                    />
                  )
                }}
              />
            </Spin>
          </TabPane>
        </Tabs>
      </Card>

      <CreateBackupModal
        visible={createBackupVisible}
        worlds={worlds}
        onOk={handleCreateBackup}
        onCancel={() => setCreateBackupVisible(false)}
      />

      <ReplaceWorldModal
        visible={replaceWorldVisible}
        worldName={selectedWorldForReplace}
        onOk={handleConfirmReplaceWorld}
        onCancel={() => setReplaceWorldVisible(false)}
      />

      <RenameWorldModal
        visible={renameWorldVisible}
        worldName={selectedWorldForRename}
        onOk={handleConfirmRenameWorld}
        onCancel={() => setRenameWorldVisible(false)}
      />
    </div>
  );
};