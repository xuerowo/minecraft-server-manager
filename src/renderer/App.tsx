import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout, message } from 'antd';
import { MainLayout } from './components/Layout/MainLayout';
import { ServerDashboard } from './pages/ServerDashboard';
import { ServerConsole } from './pages/ServerConsole';
import { ServerSettings } from './pages/ServerSettings';
import { MapManager } from './pages/MapManager';
import { PlayerManager } from './pages/PlayerManager';
import { AppSettings } from './pages/AppSettings';
import { ServerCreator } from './pages/ServerCreator';
import { I18nProvider, useI18nContext } from './components/I18nProvider';
import { useServerStore } from './store/serverStore';
import type { ElectronAPI } from '../preload/preload';

// 擴展 window 類型以包含 electronAPI
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

const { Content } = Layout;

const AppContent: React.FC = () => {
  const { setServers, updateServerStatus, addLog } = useServerStore();
  const { t } = useI18nContext();

  useEffect(() => {
    // 載入伺服器列表
    const loadServers = async () => {
      try {
        const servers = await window.electronAPI.getServerList();
        setServers(servers);
      } catch (error) {
        message.error(t('server.loadError', '載入伺服器列表失敗'));
        console.error('載入伺服器列表失敗:', error);
      }
    };

    loadServers();

    // 設置事件監聽器
    const unsubscribeStatus = window.electronAPI.onServerStatusChanged((serverInfo) => {
      updateServerStatus(serverInfo.id, serverInfo.status, {
        playerCount: serverInfo.playerCount,
        maxPlayers: serverInfo.maxPlayers,
        lastStart: serverInfo.lastStart,
      });
    });

    const unsubscribeLog = window.electronAPI.onServerLog((serverId, log) => {
      addLog(serverId, {
        timestamp: new Date(),
        level: 'INFO', // 這裡可以從日誌內容解析等級
        message: log,
      });
    });

    const unsubscribeMenu = window.electronAPI.onMenuAction((action) => {
      handleMenuAction(action);
    });

    const unsubscribeServerCreated = window.electronAPI.onServerCreated(() => {
      // 當新伺服器創建完成時，重新載入伺服器列表
      loadServers();
    });

    // 清理函數
    return () => {
      unsubscribeStatus();
      unsubscribeLog();
      unsubscribeMenu();
      unsubscribeServerCreated();
    };
  }, [setServers, updateServerStatus, addLog]);

  const handleMenuAction = (action: string) => {
    switch (action) {
      case 'open-server-directory':
        // 實現開啟伺服器目錄功能
        break;
      case 'start-server':
        // 實現啟動伺服器功能
        break;
      case 'stop-server':
        // 實現停止伺服器功能
        break;
      case 'restart-server':
        // 實現重啟伺服器功能
        break;
      default:
        break;
    }
  };

  return (
    <Layout className="min-h-screen">
      <MainLayout>
        <Content className="p-0">
          <Routes>
            <Route path="/" element={<ServerDashboard />} />
            <Route path="/console/:serverId?" element={<ServerConsole />} />
            <Route path="/settings/:serverId?" element={<ServerSettings />} />
            <Route path="/maps/:serverId?" element={<MapManager />} />
            <Route path="/players/:serverId?" element={<PlayerManager />} />
            <Route path="/app-settings" element={<AppSettings />} />
            <Route path="/create-server" element={<ServerCreator />} />
          </Routes>
        </Content>
      </MainLayout>
    </Layout>
  );
};

export const App: React.FC = () => {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
};