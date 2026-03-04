import { contextBridge, ipcRenderer } from 'electron';
import type { 
  ServerInfo, 
  ServerProperties,
  PlayerManagementData,
  PlayerCacheEntry,
  OpsEntry,
  WhitelistEntry,
  BannedPlayerEntry,
  BannedIPEntry,
  PlayerInfo
} from '../main/services/ServerManager';
import type { 
  ServerCreationConfig, 
  ServerType, 
  AvailableVersion, 
  ServerTypeInfo, 
  CreationProgress 
} from '../shared/types';
import type { LanguageCode } from '../shared/i18n';

export interface WorldInfo {
  name: string;
  path: string;
  size: number;
  lastModified: Date;
  hasLevelData: boolean;
  type: 'overworld' | 'end' | 'nether' | 'custom';
}

export interface BackupInfo {
  name: string;
  fileName: string;
  path: string;
  size: number;
  createdAt: Date;
  worlds?: string[];
}

export interface AppSettings {
  language: LanguageCode;
  customServerPath: string;
}

export interface ElectronAPI {
  // 設定管理
  loadSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<{ success: boolean }>;
  resetSettings: () => Promise<{ success: boolean }>;
  
  // 伺服器管理
  getServerList: () => Promise<ServerInfo[]>;
  getServerListFromPath: (customPath: string) => Promise<ServerInfo[]>;
  startServer: (serverId: string, javaArgs?: string[]) => Promise<void>;
  stopServer: (serverId: string) => Promise<void>;
  sendServerCommand: (serverId: string, command: string) => Promise<void>;
  getServerLogs: (serverId: string, lines?: number) => Promise<string[]>;
  deleteServer: (serverId: string) => Promise<void>;
  
  // 伺服器創建
  getServerTypes: () => Promise<ServerTypeInfo[]>;
  getAvailableVersions: (type: ServerType) => Promise<AvailableVersion[]>;
  isServerNameAvailable: (name: string) => Promise<boolean>;
  getRecommendedPort: () => Promise<number>;
  createServer: (config: ServerCreationConfig) => Promise<void>;
  
  // 伺服器配置
  getServerProperties: (serverId: string) => Promise<ServerProperties>;
  setServerProperties: (serverId: string, properties: ServerProperties) => Promise<void>;
  updateProperties: (serverId: string, updates: Partial<ServerProperties>) => Promise<void>;
  
  // 檔案系統操作
  selectDirectory: () => Promise<string | null>;
  openDirectory: (path: string) => Promise<void>;
  openFile: (filePath: string) => Promise<void>;
  
  // 地圖管理
  getWorldInfo: (serverId: string) => Promise<WorldInfo[]>;
  createBackup: (serverId: string, backupName: string, worlds: string[]) => Promise<BackupInfo>;
  getBackups: (serverId: string) => Promise<BackupInfo[]>;
  restoreBackup: (serverId: string, backupFileName: string) => Promise<boolean>;
  deleteBackup: (serverId: string, backupFileName: string) => Promise<boolean>;
  deleteWorld: (serverId: string, worldName: string) => Promise<boolean>;
  replaceWorld: (serverId: string, sourcePath: string, targetWorldName: string) => Promise<{ success: boolean; newWorldName: string }>;
  selectWorldFolder: () => Promise<string | null>;
  renameWorld: (serverId: string, oldWorldName: string, newWorldName: string) => Promise<boolean>;
  
  // 玩家管理
  getPlayerManagementData: (serverId: string) => Promise<PlayerManagementData>;
  getUserCache: (serverId: string) => Promise<PlayerCacheEntry[]>;
  getOps: (serverId: string) => Promise<OpsEntry[]>;
  setOps: (serverId: string, ops: OpsEntry[]) => Promise<void>;
  getWhitelist: (serverId: string) => Promise<WhitelistEntry[]>;
  setWhitelist: (serverId: string, whitelist: WhitelistEntry[]) => Promise<void>;
  getBannedPlayers: (serverId: string) => Promise<BannedPlayerEntry[]>;
  setBannedPlayers: (serverId: string, bannedPlayers: BannedPlayerEntry[]) => Promise<void>;
  getBannedIPs: (serverId: string) => Promise<BannedIPEntry[]>;
  setBannedIPs: (serverId: string, bannedIPs: BannedIPEntry[]) => Promise<void>;
  
  // 事件監聽
  onServerStatusChanged: (callback: (serverInfo: ServerInfo) => void) => () => void;
  onServerLog: (callback: (serverId: string, log: string) => void) => () => void;
  onMenuAction: (callback: (action: string) => void) => () => void;
  onCreationProgress: (callback: (progress: CreationProgress) => void) => () => void;
  onServerCreated: (callback: (data: any) => void) => () => void;
  
  // 通知
  showNotification: (title: string, body: string) => void;
  showErrorDialog: (title: string, content: string) => Promise<void>;
  showConfirmDialog: (title: string, message: string, detail?: string) => Promise<boolean>;
  
  // 視窗操作
  setWindowTitle: (title: string) => Promise<void>;

  // 系統監控
  getSystemUsage: () => Promise<{
    cpuUsage: number;
    memoryUsage: number;
    totalMemory: number;
    freeMemory: number;
    usedMemory: number;
    uptime: number;
    formatted: {
      cpuUsage: string;
      memoryUsage: string;
      totalMemory: string;
      usedMemory: string;
      freeMemory: string;
      uptime: string;
    };
  }>;
}

const electronAPI: ElectronAPI = {
  // 設定管理
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('settings:save', settings),
  resetSettings: () => ipcRenderer.invoke('settings:reset'),
  
  // 伺服器管理
  getServerList: () => ipcRenderer.invoke('server:getList'),
  getServerListFromPath: (customPath: string) => ipcRenderer.invoke('server:getListFromPath', customPath),
  startServer: (serverId: string, javaArgs?: string[]) => 
    ipcRenderer.invoke('server:start', serverId, javaArgs),
  stopServer: (serverId: string) => ipcRenderer.invoke('server:stop', serverId),
  sendServerCommand: (serverId: string, command: string) => 
    ipcRenderer.invoke('server:sendCommand', serverId, command),
  getServerLogs: (serverId: string, lines?: number) => 
    ipcRenderer.invoke('server:getLogs', serverId, lines),
  deleteServer: (serverId: string) => 
    ipcRenderer.invoke('server:delete', serverId),
  
  // 伺服器創建
  getServerTypes: () => ipcRenderer.invoke('server:getServerTypes'),
  getAvailableVersions: (type: ServerType) => 
    ipcRenderer.invoke('server:getAvailableVersions', type),
  isServerNameAvailable: (name: string) => 
    ipcRenderer.invoke('server:isServerNameAvailable', name),
  getRecommendedPort: () => ipcRenderer.invoke('server:getRecommendedPort'),
  createServer: (config: ServerCreationConfig) => 
    ipcRenderer.invoke('server:create', config),
  
  // 伺服器配置
  getServerProperties: (serverId: string) => 
    ipcRenderer.invoke('server:getProperties', serverId),
  setServerProperties: (serverId: string, properties: ServerProperties) => 
    ipcRenderer.invoke('server:setProperties', serverId, properties),
  updateProperties: (serverId: string, updates: Partial<ServerProperties>) => 
    ipcRenderer.invoke('server:updateProperties', serverId, updates),
  
  // 檔案系統操作
  selectDirectory: () => ipcRenderer.invoke('fs:selectDirectory'),
  openDirectory: (path: string) => ipcRenderer.invoke('fs:openDirectory', path),
  openFile: (filePath: string) => ipcRenderer.invoke('fs:openFile', filePath),
  
  // 地圖管理
  getWorldInfo: (serverId: string) => ipcRenderer.invoke('map:getWorldInfo', serverId),
  createBackup: (serverId: string, backupName: string, worlds: string[]) => 
    ipcRenderer.invoke('map:createBackup', serverId, backupName, worlds),
  getBackups: (serverId: string) => ipcRenderer.invoke('map:getBackups', serverId),
  restoreBackup: (serverId: string, backupFileName: string) => 
    ipcRenderer.invoke('map:restoreBackup', serverId, backupFileName),
  deleteBackup: (serverId: string, backupFileName: string) => 
    ipcRenderer.invoke('map:deleteBackup', serverId, backupFileName),
  deleteWorld: (serverId: string, worldName: string) => 
    ipcRenderer.invoke('map:deleteWorld', serverId, worldName),
  replaceWorld: (serverId: string, sourcePath: string, targetWorldName: string) => 
    ipcRenderer.invoke('map:replaceWorld', serverId, sourcePath, targetWorldName),
  selectWorldFolder: () => ipcRenderer.invoke('map:selectWorldFolder'),
  renameWorld: (serverId: string, oldWorldName: string, newWorldName: string) => 
    ipcRenderer.invoke('map:renameWorld', serverId, oldWorldName, newWorldName),
  
  // 玩家管理
  getPlayerManagementData: (serverId: string) => 
    ipcRenderer.invoke('player:getPlayerManagementData', serverId),
  getUserCache: (serverId: string) => 
    ipcRenderer.invoke('player:getUserCache', serverId),
  getOps: (serverId: string) => 
    ipcRenderer.invoke('player:getOps', serverId),
  setOps: (serverId: string, ops: OpsEntry[]) => 
    ipcRenderer.invoke('player:setOps', serverId, ops),
  getWhitelist: (serverId: string) => 
    ipcRenderer.invoke('player:getWhitelist', serverId),
  setWhitelist: (serverId: string, whitelist: WhitelistEntry[]) => 
    ipcRenderer.invoke('player:setWhitelist', serverId, whitelist),
  getBannedPlayers: (serverId: string) => 
    ipcRenderer.invoke('player:getBannedPlayers', serverId),
  setBannedPlayers: (serverId: string, bannedPlayers: BannedPlayerEntry[]) => 
    ipcRenderer.invoke('player:setBannedPlayers', serverId, bannedPlayers),
  getBannedIPs: (serverId: string) => 
    ipcRenderer.invoke('player:getBannedIPs', serverId),
  setBannedIPs: (serverId: string, bannedIPs: BannedIPEntry[]) => 
    ipcRenderer.invoke('player:setBannedIPs', serverId, bannedIPs),
  
  // 事件監聽
  onServerStatusChanged: (callback: (serverInfo: ServerInfo) => void) => {
    const listener = (_: any, serverInfo: ServerInfo) => callback(serverInfo);
    ipcRenderer.on('server:statusChanged', listener);
    return () => ipcRenderer.removeListener('server:statusChanged', listener);
  },
  
  onServerLog: (callback: (serverId: string, log: string) => void) => {
    const listener = (_: any, serverId: string, log: string) => callback(serverId, log);
    ipcRenderer.on('server:log', listener);
    return () => ipcRenderer.removeListener('server:log', listener);
  },
  
  onMenuAction: (callback: (action: string) => void) => {
    const listener = (_: any, action: string) => callback(action);
    ipcRenderer.on('menu:action', listener);
    return () => ipcRenderer.removeListener('menu:action', listener);
  },
  
  onCreationProgress: (callback: (progress: CreationProgress) => void) => {
    const listener = (_: any, progress: CreationProgress) => callback(progress);
    ipcRenderer.on('server:creationProgress', listener);
    return () => ipcRenderer.removeListener('server:creationProgress', listener);
  },
  
  onServerCreated: (callback: (data: any) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('server:serverCreated', listener);
    return () => ipcRenderer.removeListener('server:serverCreated', listener);
  },
  
  // 通知
  showNotification: (title: string, body: string) => {
    ipcRenderer.invoke('notification:show', title, body);
  },
  
  showErrorDialog: (title: string, content: string) => 
    ipcRenderer.invoke('dialog:showError', title, content),
  
  showConfirmDialog: (title: string, message: string, detail?: string) => 
    ipcRenderer.invoke('dialog:showConfirm', title, message, detail),
  
  // 視窗操作
  setWindowTitle: (title: string) => ipcRenderer.invoke('window:setTitle', title),

  // 系統監控
  getSystemUsage: () => ipcRenderer.invoke('system:getUsage')
};

// 將 API 暴露給渲染程序
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// 類型聲明檔案會需要這個
export type { ElectronAPI };