import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Card, 
  Typography, 
  Empty, 
  Tabs, 
  Table, 
  Button, 
  Input, 
  Modal, 
  Form, 
  message, 
  Space, 
  Badge,
  Popconfirm,
  Select,
  Tag,
  Tooltip,
  DatePicker,
  Switch
} from 'antd';
import {
  UserOutlined,
  CrownOutlined,
  StopOutlined,
  SafetyCertificateOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
  HistoryOutlined
} from '@ant-design/icons';
import { useServerStore } from '../store/serverStore';
import { useI18n } from '../hooks/useI18n';
import type { 
  PlayerManagementData,
  PlayerCacheEntry,
  OpsEntry,
  WhitelistEntry,
  BannedPlayerEntry,
  BannedIPEntry 
} from '../../preload/preload';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

interface PlayerDisplayInfo {
  uuid: string;
  username: string;
  lastSeen?: Date;
  online: boolean;
  isOp: boolean;
  opLevel: number;
}

export const PlayerManager: React.FC = () => {
  const { serverId } = useParams<{ serverId: string }>();
  const { servers } = useServerStore();
  const { t } = useI18n();
  const server = serverId ? servers.find(s => s.id === serverId) : null;

  // 狀態管理
  const [playerManagementData, setPlayerManagementData] = useState<PlayerManagementData | null>(null);
  const [players, setPlayers] = useState<PlayerDisplayInfo[]>([]);
  const [bannedPlayers, setBannedPlayers] = useState<BannedPlayerEntry[]>([]);
  const [bannedIPs, setBannedIPs] = useState<BannedIPEntry[]>([]);
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [ops, setOps] = useState<OpsEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal狀態
  const [opModalVisible, setOpModalVisible] = useState(false);
  const [banModalVisible, setBanModalVisible] = useState(false);
  const [whitelistModalVisible, setWhitelistModalVisible] = useState(false);
  
  const [form] = Form.useForm();

  useEffect(() => {
    if (server) {
      loadPlayerData();
    }
  }, [server]);

  const loadPlayerData = async () => {
    if (!serverId) return;
    
    setLoading(true);
    try {
      // 載入玩家管理數據
      const data = await window.electronAPI.getPlayerManagementData(serverId);
      setPlayerManagementData(data);
      
      // 載入各種玩家數據
      const [opsData, whitelistData, bannedPlayersData, bannedIPsData] = await Promise.all([
        window.electronAPI.getOps(serverId),
        window.electronAPI.getWhitelist(serverId),
        window.electronAPI.getBannedPlayers(serverId),
        window.electronAPI.getBannedIPs(serverId)
      ]);
      
      setOps(opsData);
      setWhitelist(whitelistData);
      setBannedPlayers(bannedPlayersData);
      setBannedIPs(bannedIPsData);
      
      // 合併玩家數據
      const playersMap = new Map<string, PlayerDisplayInfo>();
      
      // 從玩家列表獲取玩家基本信息
      data.players.forEach(player => {
        playersMap.set(player.uuid, {
          uuid: player.uuid,
          username: player.username,
          lastSeen: player.lastSeen,
          online: player.online,
          isOp: player.isOp,
          opLevel: 0
        });
      });
      
      // 添加OP信息
      opsData.forEach(op => {
        const player = playersMap.get(op.uuid);
        if (player) {
          player.isOp = true;
          player.opLevel = op.level;
        } else {
          // OP玩家但不在usercache中
          playersMap.set(op.uuid, {
            uuid: op.uuid,
            username: op.name,
            online: false,
            isOp: true,
            opLevel: op.level
          });
        }
      });
      
      setPlayers(Array.from(playersMap.values()));
      
      message.success(t('players.dataLoadedSuccess'));
    } catch (error) {
      message.error(t('players.dataLoadFailed'));
      console.error(t('players.dataLoadFailed'), error);
    } finally {
      setLoading(false);
    }
  };

  // OP權限管理
  const handleToggleOp = async (player: PlayerDisplayInfo) => {
    try {
      let newOps: OpsEntry[];
      if (player.isOp) {
        // 移除OP
        newOps = ops.filter(op => op.uuid !== player.uuid);
        await window.electronAPI.sendServerCommand(serverId!, `deop ${player.username}`);
      } else {
        // 添加OP
        const newOp: OpsEntry = {
          uuid: player.uuid,
          name: player.username,
          level: 4,
          bypassesPlayerLimit: false
        };
        newOps = [...ops, newOp];
        await window.electronAPI.sendServerCommand(serverId!, `op ${player.username}`);
      }
      
      // 更新本地數據
      await window.electronAPI.setOps(serverId!, newOps);
      setOps(newOps);
      
      // 更新玩家列表
      setPlayers(prev => prev.map(p => 
        p.uuid === player.uuid ? { ...p, isOp: !p.isOp, opLevel: p.isOp ? 0 : 4 } : p
      ));
      
      message.success(player.isOp ? t('players.opRemoved', { username: player.username }) : t('players.opGranted', { username: player.username }));
    } catch (error: any) {
      message.error(t('players.opPermissionFailed', { error: error.message }));
    }
  };

  // 編輯OP等級
  const handleEditOpLevel = async (player: PlayerDisplayInfo, level: number) => {
    try {
      const newOps = ops.map(op => 
        op.uuid === player.uuid ? { ...op, level } : op
      );
      
      // 更新本地數據
      await window.electronAPI.setOps(serverId!, newOps);
      setOps(newOps);
      
      // 更新玩家列表
      setPlayers(prev => prev.map(p => 
        p.uuid === player.uuid ? { ...p, opLevel: level } : p
      ));
      
      message.success(t('players.opLevelSet', { username: player.username, level }));
    } catch (error: any) {
      message.error(t('players.opLevelFailed', { error: error.message }));
    }
  };

  // 添加新OP玩家
  const handleAddOp = async (values: any) => {
    try {
      const { username, level } = values;
      
      // 先檢查玩家是否已在usercache中
      let playerUuid = '';
      const cachedPlayer = playerManagementData?.players.find(p => p.username === username);
      if (cachedPlayer) {
        playerUuid = cachedPlayer.uuid;
      }
      
      const newOp: OpsEntry = {
        uuid: playerUuid,
        name: username,
        level: parseInt(level),
        bypassesPlayerLimit: false
      };
      
      const newOps = [...ops, newOp];
      
      // 發送伺服器指令
      await window.electronAPI.sendServerCommand(serverId!, `op ${username}`);
      
      // 更新本地數據
      await window.electronAPI.setOps(serverId!, newOps);
      setOps(newOps);
      
      // 如果玩家在列表中，更新狀態
      setPlayers(prev => prev.map(p => 
        p.username === username ? { ...p, isOp: true, opLevel: parseInt(level) } : p
      ));
      
      setOpModalVisible(false);
      form.resetFields();
      message.success(t('players.opAdded', { username, level }));
    } catch (error: any) {
      message.error(t('players.opAddFailed', { error: error.message }));
    }
  };

  // 封禁玩家
  const handleBanPlayer = async (values: any) => {
    try {
      const { username, reason } = values;
      let command = `ban ${username}`;
      if (reason) command += ` ${reason}`;

      await window.electronAPI.sendServerCommand(serverId!, command);
      
      const newBan: BannedPlayerEntry = {
        uuid: '', // 將由伺服器填入
        name: username,
        reason: reason || t('players.noReasonSpecified'),
        source: 'Admin',
        created: new Date().toISOString(),
        expires: 'forever'
      };

      const newBannedPlayers = [...bannedPlayers, newBan];
      await window.electronAPI.setBannedPlayers(serverId!, newBannedPlayers);
      setBannedPlayers(newBannedPlayers);
      
      setBanModalVisible(false);
      form.resetFields();
      message.success(t('players.playerBanned', { username }));
    } catch (error: any) {
      message.error(t('players.banFailed', { error: error.message }));
    }
  };

  // 解除封禁
  const handleUnbanPlayer = async (username: string) => {
    try {
      await window.electronAPI.sendServerCommand(serverId!, `pardon ${username}`);
      
      const newBannedPlayers = bannedPlayers.filter(p => p.name !== username);
      await window.electronAPI.setBannedPlayers(serverId!, newBannedPlayers);
      setBannedPlayers(newBannedPlayers);
      
      message.success(t('players.playerUnbanned', { username }));
    } catch (error: any) {
      message.error(t('players.unbanFailed', { error: error.message }));
    }
  };

  // 白名單管理
  const handleAddToWhitelist = async (values: any) => {
    try {
      const { username } = values;
      await window.electronAPI.sendServerCommand(serverId!, `whitelist add ${username}`);
      
      const newEntry: WhitelistEntry = {
        uuid: '', // 將由伺服器填入
        name: username
      };

      const newWhitelist = [...whitelist, newEntry];
      await window.electronAPI.setWhitelist(serverId!, newWhitelist);
      setWhitelist(newWhitelist);
      
      setWhitelistModalVisible(false);
      form.resetFields();
      message.success(t('players.whitelistAdded', { username }));
    } catch (error: any) {
      message.error(t('players.whitelistAddFailed', { error: error.message }));
    }
  };

  const handleRemoveFromWhitelist = async (username: string) => {
    try {
      await window.electronAPI.sendServerCommand(serverId!, `whitelist remove ${username}`);
      
      const newWhitelist = whitelist.filter(p => p.name !== username);
      await window.electronAPI.setWhitelist(serverId!, newWhitelist);
      setWhitelist(newWhitelist);
      
      message.success(t('players.whitelistRemoved', { username }));
    } catch (error: any) {
      message.error(t('players.whitelistRemoveFailed', { error: error.message }));
    }
  };

  // 表格列定義
  const playerColumns = [
    {
      title: t('players.playerName'),
      dataIndex: 'username',
      key: 'username',
      render: (text: string, record: PlayerDisplayInfo) => (
        <Space>
          <Badge status={record.online ? 'success' : 'default'} />
          <UserOutlined />
          {text}
          {record.isOp && <CrownOutlined style={{ color: '#ffd700' }} />}
        </Space>
      ),
    },
    {
      title: t('players.status'),
      key: 'status',
      render: (_: any, record: PlayerDisplayInfo) => (
        <Space>
          <Tag color={record.online ? 'green' : 'default'}>
            {record.online ? t('players.online') : t('players.offline')}
          </Tag>
          {record.isOp && <Tag color="gold">{t('players.opLevel')}: {record.opLevel}</Tag>}
        </Space>
      ),
    },
    {
      title: t('players.lastSeen'),
      dataIndex: 'lastSeen',
      key: 'lastSeen',
      render: (date?: Date) => date ? date.toLocaleDateString() : t('players.unknown'),
    },
    {
      title: t('players.uuid'),
      dataIndex: 'uuid',
      key: 'uuid',
      render: (text: string) => (
        <Text code style={{ fontSize: '12px' }}>
          {text.substring(0, 8)}...
        </Text>
      ),
    },
    {
      title: t('players.actions'),
      key: 'actions',
      render: (_: any, record: PlayerDisplayInfo) => (
        <Space>
          <Tooltip title={record.isOp ? t('players.removeOp') : t('players.grantOp')}>
            <Button
              size="small"
              type={record.isOp ? 'primary' : 'default'}
              icon={<CrownOutlined />}
              onClick={() => handleToggleOp(record)}
              disabled={server?.status !== 'running'}
            />
          </Tooltip>
          {record.isOp && (
            <Tooltip title={t('players.editOpLevel')}>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  Modal.confirm({
                    title: t('players.editOpLevel'),
                    content: (
                      <div>
                        <p>{t('players.selectOpLevel', { username: record.username })}</p>
                        <Select 
                          defaultValue={record.opLevel.toString()} 
                          style={{ width: '100%', marginTop: 8 }}
                          onChange={(value) => {
                            handleEditOpLevel(record, parseInt(value));
                            Modal.destroyAll();
                          }}
                        >
                          <Select.Option value="1">{t('players.lowestPermission')}</Select.Option>
                          <Select.Option value="2">2</Select.Option>
                          <Select.Option value="3">3</Select.Option>
                          <Select.Option value="4">{t('players.highestPermission')}</Select.Option>
                        </Select>
                      </div>
                    ),
                    onOk: () => {},
                    okText: t('common.cancel'),
                    cancelText: null,
                    closable: true,
                    maskClosable: true
                  });
                }}
                disabled={server?.status !== 'running'}
              />
            </Tooltip>
          )}
          <Tooltip title={t('players.banPlayer')}>
            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={() => {
                form.setFieldsValue({ username: record.username });
                setBanModalVisible(true);
              }}
              disabled={server?.status !== 'running'}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const bannedColumns = [
    {
      title: t('players.playerName'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('players.banReason'),
      dataIndex: 'reason',
      key: 'reason',
    },
    {
      title: t('players.banSource'),
      dataIndex: 'source',
      key: 'source',
    },
    {
      title: t('players.banTime'),
      dataIndex: 'created',
      key: 'created',
      render: (dateString: string) => new Date(dateString).toLocaleDateString(),
    },
    {
      title: t('players.expiryTime'),
      dataIndex: 'expires',
      key: 'expires',
      render: (expires: string) => expires === 'forever' ? t('players.permanent') : new Date(expires).toLocaleDateString(),
    },
    {
      title: t('players.actions'),
      key: 'actions',
      render: (_: any, record: BannedPlayerEntry) => (
        <Popconfirm
          title={t('players.confirmUnban')}
          onConfirm={() => handleUnbanPlayer(record.name)}
          disabled={server?.status !== 'running'}
        >
          <Button 
            size="small" 
            type="primary" 
            icon={<SafetyCertificateOutlined />}
            disabled={server?.status !== 'running'}
          >
            {t('players.unban')}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const whitelistColumns = [
    {
      title: t('players.playerName'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('players.uuid'),
      dataIndex: 'uuid',
      key: 'uuid',
      render: (text: string) => (
        <Text code style={{ fontSize: '12px' }}>
          {text ? `${text.substring(0, 8)}...` : t('players.unknown')}
        </Text>
      ),
    },
    {
      title: t('players.actions'),
      key: 'actions',
      render: (_: any, record: WhitelistEntry) => (
        <Popconfirm
          title={t('players.confirmRemove')}
          onConfirm={() => handleRemoveFromWhitelist(record.name)}
          disabled={server?.status !== 'running'}
        >
          <Button 
            size="small" 
            danger 
            icon={<DeleteOutlined />}
            disabled={server?.status !== 'running'}
          >
            {t('players.remove')}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  if (!server) {
    return (
      <div className="p-6">
        <Card>
          <Empty
            description={t('players.selectServerFirst')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <Title level={3} className="!text-white !mb-2">
          {t('players.pageTitle', { serverName: server.name })}
        </Title>
        <Text type="secondary">
          {t('players.pageDescription')}
        </Text>
      </div>

      <Tabs 
        defaultActiveKey="players"
        items={[
          {
            key: 'players',
            label: (
              <span>
                <UserOutlined />
                {t('players.playerList')} 
                <Badge count={players.length} size="small" style={{ marginLeft: 8 }} />
              </span>
            ),
            children: (
              <Card>
                <div className="mb-4 flex justify-between">
                  <Space>
                    <Button 
                      icon={<ReloadOutlined />} 
                      onClick={loadPlayerData}
                      loading={loading}
                    >
                      {t('common.refresh')}
                    </Button>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => setOpModalVisible(true)}
                      disabled={server?.status !== 'running'}
                    >
                      {t('players.addOp')}
                    </Button>
                    <Text type="secondary">
                      {t('players.onlinePlayersCount', { count: players.filter(p => p.online).length })}
                    </Text>
                  </Space>
                </div>
                
                <Table
                  columns={playerColumns}
                  dataSource={players}
                  rowKey="uuid"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  size="middle"
                />
              </Card>
            )
          },
          {
            key: 'banned',
            label: (
              <span>
                <StopOutlined />
                {t('players.banList')}
                <Badge count={bannedPlayers.length} size="small" style={{ marginLeft: 8 }} />
              </span>
            ),
            children: (
              <Card>
                <div className="mb-4">
                  <Button 
                    type="primary" 
                    icon={<PlusOutlined />}
                    onClick={() => setBanModalVisible(true)}
                    disabled={server.status !== 'running'}
                  >
                    {t('players.banPlayer')}
                  </Button>
                </div>
                
                <Table
                  columns={bannedColumns}
                  dataSource={bannedPlayers}
                  rowKey="username"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  size="middle"
                />
              </Card>
            )
          },
          {
            key: 'whitelist',
            label: (
              <span>
                <SafetyCertificateOutlined />
                {t('players.whitelist')}
                <Badge count={whitelist.length} size="small" style={{ marginLeft: 8 }} />
              </span>
            ),
            children: (
              <Card>
                <div className="mb-4 flex justify-between">
                  <Button 
                    type="primary" 
                    icon={<PlusOutlined />}
                    onClick={() => setWhitelistModalVisible(true)}
                    disabled={server.status !== 'running'}
                  >
                    {t('common.add')}
                  </Button>
                  <Space>
                    <Button
                      onClick={async () => {
                        try {
                          await window.electronAPI.sendServerCommand(serverId!, 'whitelist on');
                          message.success(t('players.whitelistEnabled'));
                        } catch (error: any) {
                          message.error(t('players.whitelistEnableFailed'));
                        }
                      }}
                      disabled={server.status !== 'running'}
                    >
                      {t('players.enableWhitelist')}
                    </Button>
                    <Button
                      onClick={async () => {
                        try {
                          await window.electronAPI.sendServerCommand(serverId!, 'whitelist off');
                          message.success(t('players.whitelistDisabled'));
                        } catch (error: any) {
                          message.error(t('players.whitelistDisableFailed'));
                        }
                      }}
                      disabled={server.status !== 'running'}
                    >
                      {t('players.disableWhitelist')}
                    </Button>
                  </Space>
                </div>
                
                <Table
                  columns={whitelistColumns}
                  dataSource={whitelist}
                  rowKey="username"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  size="middle"
                />
              </Card>
            )
          }
        ]}
      />

      {/* 封禁玩家Modal */}
      <Modal
        title={t('players.banPlayerTitle')}
        open={banModalVisible}
        onCancel={() => {
          setBanModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleBanPlayer}
        >
          <Form.Item
            name="username"
            label={t('players.playerNameLabel')}
            rules={[{ required: true, message: t('players.playerNameLabel') }]}
          >
            <Input placeholder={t('players.playerNamePlaceholder')} />
          </Form.Item>
          
          <Form.Item
            name="reason"
            label={t('players.banReason')}
          >
            <Input.TextArea placeholder={t('players.banReasonPlaceholder')} rows={3} />
          </Form.Item>
          
          <Form.Item
            name="duration"
            label={t('players.selectBanDuration')}
          >
            <Select placeholder={t('players.selectBanDuration')}>
              <Select.Option value={undefined}>{t('players.permanent')}</Select.Option>
              <Select.Option value={1}>1{t('players.days')}</Select.Option>
              <Select.Option value={7}>7{t('players.days')}</Select.Option>
              <Select.Option value={30}>30{t('players.days')}</Select.Option>
            </Select>
          </Form.Item>
          
          <div className="flex justify-end space-x-2">
            <Button onClick={() => setBanModalVisible(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="primary" danger htmlType="submit">
              {t('players.banPlayer')}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* 添加白名單Modal */}
      <Modal
        title={t('players.addToWhitelistTitle')}
        open={whitelistModalVisible}
        onCancel={() => {
          setWhitelistModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddToWhitelist}
        >
          <Form.Item
            name="username"
            label={t('players.playerNameLabel')}
            rules={[{ required: true, message: t('players.playerNameLabel') }]}
          >
            <Input placeholder={t('players.playerNamePlaceholder')} />
          </Form.Item>
          
          <div className="flex justify-end space-x-2">
            <Button onClick={() => setWhitelistModalVisible(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="primary" htmlType="submit">
              {t('common.add')}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* 添加OP玩家Modal */}
      <Modal
        title={t('players.addOpTitle')}
        open={opModalVisible}
        onCancel={() => {
          setOpModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddOp}
        >
          <Form.Item
            name="username"
            label={t('players.playerNameLabel')}
            rules={[{ required: true, message: t('players.playerNameLabel') }]}
          >
            <Input placeholder={t('players.opPlayerPlaceholder')} />
          </Form.Item>
          
          <Form.Item
            name="level"
            label={t('players.opLevel')}
            initialValue="4"
            rules={[{ required: true, message: t('players.opLevel') }]}
          >
            <Select placeholder={t('players.opLevel')}>
              <Select.Option value="1">{t('players.lowestPermission')}</Select.Option>
              <Select.Option value="2">2</Select.Option>
              <Select.Option value="3">3</Select.Option>
              <Select.Option value="4">{t('players.highestPermission')}</Select.Option>
            </Select>
          </Form.Item>
          
          <div className="flex justify-end space-x-2">
            <Button onClick={() => setOpModalVisible(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="primary" htmlType="submit">
              {t('common.add')}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};