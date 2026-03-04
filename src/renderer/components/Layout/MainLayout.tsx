import React, { useState } from 'react';
import { Layout, Menu, Typography, Avatar, Dropdown, Space, Badge } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  CodeOutlined,
  SettingOutlined,
  GlobalOutlined,
  UserOutlined,
  AppstoreOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PoweroffOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { useServerStore } from '../../store/serverStore';
import { useI18n } from '../../hooks/useI18n';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { servers, currentServerId } = useServerStore();
  const { t } = useI18n();

  const runningServers = servers.filter(server => server.status === 'running');
  const currentServer = currentServerId 
    ? servers.find(server => server.id === currentServerId)
    : null;

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: t('menu.dashboard'),
    },
    {
      type: 'divider' as const,
    },
    {
      key: '/console',
      icon: <CodeOutlined />,
      label: t('menu.console'),
      disabled: !currentServerId,
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: t('menu.serverSettings'),
      disabled: !currentServerId,
    },
    {
      key: '/maps',
      icon: <GlobalOutlined />,
      label: t('menu.mapManager'),
      disabled: !currentServerId,
    },
    {
      key: '/players',
      icon: <UserOutlined />,
      label: t('menu.playerManager'),
      disabled: !currentServerId,
    },
    {
      type: 'divider' as const,
    },
    {
      key: '/app-settings',
      icon: <AppstoreOutlined />,
      label: t('menu.appSettings'),
    },
  ];

  const userMenuItems = [
    {
      key: 'refresh',
      icon: <PlayCircleOutlined />,
      label: t('menu.refreshServerList'),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'exit',
      icon: <PoweroffOutlined />,
      label: t('menu.exitApp'),
      danger: true,
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === '/console' && currentServerId) {
      navigate(`/console/${currentServerId}`);
    } else if (key === '/settings' && currentServerId) {
      navigate(`/settings/${currentServerId}`);
    } else if (key === '/maps' && currentServerId) {
      navigate(`/maps/${currentServerId}`);
    } else if (key === '/players' && currentServerId) {
      navigate(`/players/${currentServerId}`);
    } else {
      navigate(key);
    }
  };

  const handleUserMenuClick = async ({ key }: { key: string }) => {
    switch (key) {
      case 'refresh':
        try {
          const servers = await window.electronAPI.getServerList();
          useServerStore.getState().setServers(servers);
        } catch (error) {
          console.error(t('errors.refreshServerListFailed'), error);
        }
        break;
      case 'exit':
        // 在這裡可以添加確認對話框
        window.close();
        break;
    }
  };

  const getSelectedKey = () => {
    const path = location.pathname;
    if (path.startsWith('/console')) return '/console';
    if (path.startsWith('/settings')) return '/settings';
    if (path.startsWith('/maps')) return '/maps';
    if (path.startsWith('/players')) return '/players';
    if (path.startsWith('/app-settings')) return '/app-settings';
    return '/';
  };

  return (
    <Layout className="min-h-screen">
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        className="shadow-lg"
        theme="dark"
        width={240}
      >
        <div className="p-4 border-b border-gray-600">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-minecraft-green rounded mr-3 flex items-center justify-center">
              <span className="text-black font-bold text-sm">MC</span>
            </div>
            {!collapsed && (
              <div>
                <Title level={5} className="!text-white !mb-0">
                  {t('app.title')}
                </Title>
                {currentServer && (
                  <Text className="text-xs text-gray-400">
                    {t('menu.currentServer', { name: currentServer.name })}
                  </Text>
                )}
              </div>
            )}
          </div>
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          items={menuItems}
          onClick={handleMenuClick}
          className="border-r-0"
        />

        {!collapsed && (
          <div className="absolute bottom-4 left-4 right-4">
            <div className="bg-gray-800 rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <Text className="text-xs text-gray-400">{t('menu.runningStatus')}</Text>
                <Badge count={runningServers.length} size="small" />
              </div>
              <Text className="text-xs text-gray-300">
                {t('menu.serversRunning', { count: runningServers.length })}
              </Text>
            </div>
          </div>
        )}
      </Sider>

      <Layout>
        <Header className="bg-gray-800 px-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="text-white hover:text-minecraft-green transition-colors mr-4"
            >
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </button>

            {currentServer && (
              <Space>
                <div className={`status-indicator status-${currentServer.status}`} />
                <Title level={4} className="!text-white !mb-0">
                  {currentServer.name}
                </Title>
                <Text className="text-gray-400">
                  {currentServer.version}
                </Text>
              </Space>
            )}
          </div>

          <Dropdown
            menu={{
              items: userMenuItems,
              onClick: handleUserMenuClick,
            }}
            trigger={['click']}
          >
            <div className="flex items-center cursor-pointer hover:bg-gray-700 px-3 py-2 rounded transition-colors">
              <Avatar
                size="small"
                icon={<UserOutlined />}
                className="bg-minecraft-green mr-2"
              />
              {!collapsed && <Text className="text-white">{t('menu.administrator')}</Text>}
            </div>
          </Dropdown>
        </Header>

        <Content className="bg-gray-900 overflow-auto">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};