import type { ElectronAPI, WorldInfo, BackupInfo } from '../../preload/preload';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export type { ElectronAPI, WorldInfo, BackupInfo };