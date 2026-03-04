// 重新導出 ServerManager 中的類型
export type { ServerInfo, ServerProperties } from '../../main/services/ServerManager';

// 應用程式主題
export type Theme = 'light' | 'dark' | 'system';

// 應用程式設置
export interface AppSettings {
  theme: Theme;
  language: string;
  autoStart: boolean;
  minimizeToTray: boolean;
  serverBasePath: string;
  javaPath?: string;
  defaultJavaArgs: string[];
}

// 伺服器統計資訊
export interface ServerStats {
  serverId: string;
  uptime: number;
  playerCount: number;
  maxPlayers: number;
  memoryUsage: {
    used: number;
    max: number;
  };
  tps: number; // Ticks per second
}

// 玩家資訊
export interface PlayerInfo {
  uuid: string;
  name: string;
  isOp: boolean;
  isBanned: boolean;
  isWhitelisted: boolean;
  lastSeen?: Date;
  joinCount?: number;
}

// 備份資訊
export interface BackupInfo {
  id: string;
  serverId: string;
  name: string;
  fileName: string;
  path: string;
  size: number;
  createdAt: Date;
  type: 'manual' | 'auto';
}

// 世界資訊
export interface WorldInfo {
  name: string;
  path: string;
  size: number;
  type: 'overworld' | 'nether' | 'end' | 'custom';
  lastModified: Date;
  hasLevelData: boolean;
}

// 日誌等級
export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'TRACE';

// 日誌條目
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  source?: string;
}

// 伺服器版本資訊
export interface ServerVersion {
  id: string;
  name: string;
  type: 'vanilla' | 'forge' | 'fabric' | 'spigot' | 'paper' | 'bukkit';
  minecraftVersion: string;
  downloadUrl?: string;
  isInstalled: boolean;
}

// 模組資訊（用於 Forge/Fabric 伺服器）
export interface ModInfo {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  file: string;
  enabled: boolean;
  dependencies?: string[];
}

// 伺服器創建相關型別
export type ServerType = 'vanilla' | 'paper' | 'spigot' | 'fabric' | 'forge';

export interface ServerCreationConfig {
  name: string;
  type: ServerType;
  version: string;
  minMemory: string;
  maxMemory: string;
  port: number;
  javaArgs?: string[];
}

export interface AvailableVersion {
  id: string;
  type: 'release' | 'snapshot' | 'experimental';
  url?: string;
  releaseTime: string;
  stable?: boolean;
}

export interface ServerTypeInfo {
  type: ServerType;
  name: string;
  description: string;
  icon?: string;
  supportsMods: boolean;
  supportsPlugins: boolean;
}

export interface CreationProgress {
  step: 'downloading' | 'extracting' | 'configuring' | 'initializing' | 'completed' | 'error';
  progress: number;
  message: string;
  error?: string;
}