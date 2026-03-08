import { ipcMain, dialog, shell, BrowserWindow, Notification } from 'electron';
import { ServerManager } from '../services/ServerManager';
import * as fs from 'fs/promises';
import * as path from 'path';
import AdmZip from 'adm-zip';

export function setupIPC(serverManager: ServerManager, mainWindow: BrowserWindow | null): void {
  
  // 伺服器管理相關 IPC 處理器
  ipcMain.handle('server:getList', async () => {
    try {
      return await serverManager.scanServers();
    } catch (error) {
      console.error('獲取伺服器列表失敗:', error);
      throw error;
    }
  });

  ipcMain.handle('server:start', async (_event, serverId: string, javaArgs?: string[]) => {
    try {
      const server = await serverManager.loadServer(serverId);
      await server.start(javaArgs);
    } catch (error) {
      console.error(`啟動伺服器 ${serverId} 失敗:`, error);
      throw error;
    }
  });

  ipcMain.handle('server:stop', async (_event, serverId: string) => {
    try {
      console.log(`[IPC] 收到停止伺服器請求: ${serverId}`);
      let server = serverManager.getServer(serverId);
      if (!server) {
        console.log(`[IPC] 伺服器實例不存在，嘗試載入: ${serverId}`);
        server = await serverManager.loadServer(serverId);
      }
      
      if (server) {
        await server.stop();
      } else {
        console.error(`[IPC] 無法獲取伺服器實例: ${serverId}`);
      }
    } catch (error) {
      console.error(`停止伺服器 ${serverId} 失敗:`, error);
      throw error;
    }
  });

  ipcMain.handle('server:sendCommand', async (_event, serverId: string, command: string) => {
    try {
      const server = serverManager.getServer(serverId);
      if (server) {
        server.sendCommand(command);
      }
    } catch (error) {
      console.error(`發送指令到伺服器 ${serverId} 失敗:`, error);
      throw error;
    }
  });

  ipcMain.handle('server:getLogs', async (_event, serverId: string, lines?: number) => {
    try {
      const server = serverManager.getServer(serverId);
      return server ? server.getLogs(lines) : [];
    } catch (error) {
      console.error(`獲取伺服器 ${serverId} 日誌失敗:`, error);
      throw error;
    }
  });

  // 伺服器配置相關 IPC 處理器
  ipcMain.handle('server:getProperties', async (_event, serverId: string) => {
    try {
      return await serverManager.readServerProperties(serverId);
    } catch (error) {
      console.error(`讀取伺服器 ${serverId} 配置失敗:`, error);
      throw error;
    }
  });

  ipcMain.handle('server:setProperties', async (_event, serverId: string, properties: any) => {
    try {
      await serverManager.writeServerProperties(serverId, properties);
    } catch (error) {
      console.error(`寫入伺服器 ${serverId} 配置失敗:`, error);
      throw error;
    }
  });

  // 檔案系統操作相關 IPC 處理器
  ipcMain.handle('fs:selectDirectory', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow!, {
        title: '選擇伺服器目錄',
        properties: ['openDirectory'],
        message: '請選擇 Minecraft 伺服器目錄'
      });

      return result.canceled ? null : result.filePaths[0];
    } catch (error) {
      console.error('選擇目錄失敗:', error);
      throw error;
    }
  });

  ipcMain.handle('fs:openDirectory', async (_event, path: string) => {
    try {
      await shell.openPath(path);
    } catch (error) {
      console.error(`開啟目錄 ${path} 失敗:`, error);
      throw error;
    }
  });

  // 對話框相關 IPC 處理器
  ipcMain.handle('dialog:showError', async (_event, title: string, content: string) => {
    try {
      await dialog.showMessageBox(mainWindow!, {
        type: 'error',
        title,
        message: title,
        detail: content,
        buttons: ['確定']
      });
    } catch (error) {
      console.error('顯示錯誤對話框失敗:', error);
    }
  });

  ipcMain.handle('dialog:showConfirm', async (_event, title: string, message: string, detail?: string) => {
    try {
      const result = await dialog.showMessageBox(mainWindow!, {
        type: 'question',
        title,
        message,
        detail,
        buttons: ['確定', '取消'],
        defaultId: 0,
        cancelId: 1
      });

      return result.response === 0;
    } catch (error) {
      console.error('顯示確認對話框失敗:', error);
      return false;
    }
  });

  // 通知相關 IPC 處理器
  ipcMain.handle('notification:show', async (_event, title: string, body: string) => {
    try {
      if (Notification.isSupported()) {
        const notification = new Notification({
          title,
          body,
          icon: undefined // 可以添加圖示路徑
        });
        
        notification.show();
      }
    } catch (error) {
      console.error('顯示通知失敗:', error);
    }
  });

  // 地圖管理相關 IPC 處理器
  ipcMain.handle('map:getWorldInfo', async (_event, serverId: string) => {
    try {
      const server = serverManager.getServer(serverId);
      if (!server) {
        throw new Error('伺服器不存在');
      }

      const serverPath = server.getServerPath();
      const worldsPath = path.join(serverPath);
      
      const worlds = [];
      const entries = await fs.readdir(worldsPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory() && (
          entry.name === 'world' || 
          entry.name.startsWith('world_') ||
          entry.name === 'DIM1' ||
          entry.name === 'DIM-1'
        )) {
          const worldPath = path.join(worldsPath, entry.name);
          const stats = await fs.stat(worldPath);
          
          // 檢查是否有世界檔案
          const levelDat = path.join(worldPath, 'level.dat');
          let hasLevelData = false;
          try {
            await fs.access(levelDat);
            hasLevelData = true;
          } catch {
            // level.dat 不存在
          }

          // 計算資料夾大小
          const size = await getFolderSize(worldPath);
          
          worlds.push({
            name: entry.name,
            path: worldPath,
            size,
            lastModified: stats.mtime,
            hasLevelData,
            type: entry.name === 'world' ? 'overworld' : 
                  entry.name === 'DIM1' ? 'end' :
                  entry.name === 'DIM-1' ? 'nether' : 'custom'
          });
        }
      }

      return worlds;
    } catch (error) {
      console.error(`獲取伺服器 ${serverId} 世界資訊失敗:`, error);
      throw error;
    }
  });

  ipcMain.handle('map:createBackup', async (_event, serverId: string, backupName: string, worlds: string[]) => {
    try {
      const server = serverManager.getServer(serverId);
      if (!server) {
        throw new Error('伺服器不存在');
      }

      const serverPath = server.getServerPath();
      const backupsPath = path.join(serverPath, 'backups');
      
      // 確保備份目錄存在
      await fs.mkdir(backupsPath, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `${backupName}_${timestamp}.zip`;
      const backupFilePath = path.join(backupsPath, backupFileName);

      await createWorldBackup(serverPath, backupFilePath, worlds);

      const stats = await fs.stat(backupFilePath);
      
      return {
        name: backupName,
        fileName: backupFileName,
        path: backupFilePath,
        size: stats.size,
        createdAt: stats.birthtime,
        worlds: worlds
      };
    } catch (error) {
      console.error(`創建備份失敗:`, error);
      throw error;
    }
  });

  ipcMain.handle('map:getBackups', async (_event, serverId: string) => {
    try {
      const server = serverManager.getServer(serverId);
      if (!server) {
        throw new Error('伺服器不存在');
      }

      const serverPath = server.getServerPath();
      const backupsPath = path.join(serverPath, 'backups');
      
      try {
        const entries = await fs.readdir(backupsPath, { withFileTypes: true });
        const backups = [];

        for (const entry of entries) {
          if (entry.isFile() && entry.name.endsWith('.zip')) {
            const backupPath = path.join(backupsPath, entry.name);
            const stats = await fs.stat(backupPath);
            
            // 解析備份名稱和時間戳
            const match = entry.name.match(/^(.+)_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z)\.zip$/);
            const backupName = match ? match[1] : entry.name.replace('.zip', '');

            backups.push({
              name: backupName,
              fileName: entry.name,
              path: backupPath,
              size: stats.size,
              createdAt: stats.birthtime
            });
          }
        }

        return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      } catch (error) {
        if ((error as any).code === 'ENOENT') {
          return []; // 備份目錄不存在，返回空陣列
        }
        throw error;
      }
    } catch (error) {
      console.error(`獲取備份列表失敗:`, error);
      throw error;
    }
  });

  ipcMain.handle('map:restoreBackup', async (_event, serverId: string, backupFileName: string) => {
    try {
      const server = serverManager.getServer(serverId);
      if (!server) {
        throw new Error('伺服器不存在');
      }

      // 確保伺服器已停止
      if (server.getStatus() === 'running') {
        throw new Error('請先停止伺服器再進行還原操作');
      }

      const serverPath = server.getServerPath();
      const backupsPath = path.join(serverPath, 'backups');
      const backupFilePath = path.join(backupsPath, backupFileName);

      // 檢查備份檔案是否存在
      await fs.access(backupFilePath);

      await restoreWorldBackup(backupFilePath, serverPath);
      
      return true;
    } catch (error) {
      console.error(`還原備份失敗:`, error);
      throw error;
    }
  });

  ipcMain.handle('map:deleteBackup', async (_event, serverId: string, backupFileName: string) => {
    try {
      const server = serverManager.getServer(serverId);
      if (!server) {
        throw new Error('伺服器不存在');
      }

      const serverPath = server.getServerPath();
      const backupsPath = path.join(serverPath, 'backups');
      const backupFilePath = path.join(backupsPath, backupFileName);

      await fs.unlink(backupFilePath);
      return true;
    } catch (error) {
      console.error(`刪除備份失敗:`, error);
      throw error;
    }
  });

  ipcMain.handle('map:deleteWorld', async (_event, serverId: string, worldName: string) => {
    try {
      const server = serverManager.getServer(serverId);
      if (!server) {
        throw new Error('伺服器不存在');
      }

      // 確保伺服器已停止
      if (server.getStatus() === 'running') {
        throw new Error('請先停止伺服器再進行刪除操作');
      }

      const serverPath = server.getServerPath();
      const worldPath = path.join(serverPath, worldName);

      await fs.rmdir(worldPath, { recursive: true });
      return true;
    } catch (error) {
      console.error(`刪除世界失敗:`, error);
      throw error;
    }
  });

  // === 玩家管理相關 IPC 處理器 ===
  ipcMain.handle('player:getPlayerManagementData', async (_event, serverId: string) => {
    try {
      return await serverManager.getPlayerManagementData(serverId);
    } catch (error) {
      console.error(`獲取玩家管理數據失敗 (${serverId}):`, error);
      throw error;
    }
  });

  ipcMain.handle('player:getUserCache', async (_event, serverId: string) => {
    try {
      return await serverManager.readUserCache(serverId);
    } catch (error) {
      console.error(`獲取用戶緩存失敗 (${serverId}):`, error);
      throw error;
    }
  });

  ipcMain.handle('player:getOps', async (_event, serverId: string) => {
    try {
      return await serverManager.readOps(serverId);
    } catch (error) {
      console.error(`獲取OP列表失敗 (${serverId}):`, error);
      throw error;
    }
  });

  ipcMain.handle('player:setOps', async (_event, serverId: string, ops: any[]) => {
    try {
      await serverManager.writeOps(serverId, ops);
    } catch (error) {
      console.error(`寫入OP列表失敗 (${serverId}):`, error);
      throw error;
    }
  });

  ipcMain.handle('player:getWhitelist', async (_event, serverId: string) => {
    try {
      return await serverManager.readWhitelist(serverId);
    } catch (error) {
      console.error(`獲取白名單失敗 (${serverId}):`, error);
      throw error;
    }
  });

  ipcMain.handle('player:setWhitelist', async (_event, serverId: string, whitelist: any[]) => {
    try {
      await serverManager.writeWhitelist(serverId, whitelist);
    } catch (error) {
      console.error(`寫入白名單失敗 (${serverId}):`, error);
      throw error;
    }
  });

  ipcMain.handle('player:getBannedPlayers', async (_event, serverId: string) => {
    try {
      return await serverManager.readBannedPlayers(serverId);
    } catch (error) {
      console.error(`獲取封禁玩家列表失敗 (${serverId}):`, error);
      throw error;
    }
  });

  ipcMain.handle('player:setBannedPlayers', async (_event, serverId: string, bannedPlayers: any[]) => {
    try {
      await serverManager.writeBannedPlayers(serverId, bannedPlayers);
    } catch (error) {
      console.error(`寫入封禁玩家列表失敗 (${serverId}):`, error);
      throw error;
    }
  });

  ipcMain.handle('player:getBannedIPs', async (_event, serverId: string) => {
    try {
      return await serverManager.readBannedIPs(serverId);
    } catch (error) {
      console.error(`獲取封禁IP列表失敗 (${serverId}):`, error);
      throw error;
    }
  });

  ipcMain.handle('player:setBannedIPs', async (_event, serverId: string, bannedIPs: any[]) => {
    try {
      await serverManager.writeBannedIPs(serverId, bannedIPs);
    } catch (error) {
      console.error(`寫入封禁IP列表失敗 (${serverId}):`, error);
      throw error;
    }
  });

  // 設置伺服器管理器事件轉發
  setupServerEventForwarding(serverManager, mainWindow);
  
  // 設置選單事件處理
  setupMenuEventHandling(mainWindow);
}

function setupServerEventForwarding(serverManager: ServerManager, mainWindow: BrowserWindow | null): void {
  // 轉發伺服器狀態變更事件到渲染程序
  serverManager.on('serverStatusChanged', (serverInfo) => {
    mainWindow?.webContents.send('server:statusChanged', serverInfo);
  });

  // 轉發伺服器日誌事件到渲染程序
  serverManager.on('serverLog', (serverId, log) => {
    mainWindow?.webContents.send('server:log', serverId, log);
  });
}

function setupMenuEventHandling(mainWindow: BrowserWindow | null): void {
  // 處理選單觸發的事件
  ipcMain.on('menu-open-server-directory', () => {
    mainWindow?.webContents.send('menu:action', 'open-server-directory');
  });

  ipcMain.on('menu-start-server', () => {
    mainWindow?.webContents.send('menu:action', 'start-server');
  });

  ipcMain.on('menu-stop-server', () => {
    mainWindow?.webContents.send('menu:action', 'stop-server');
  });

  ipcMain.on('menu-restart-server', () => {
    mainWindow?.webContents.send('menu:action', 'restart-server');
  });
}

// 輔助函數：計算資料夾大小
async function getFolderSize(folderPath: string): Promise<number> {
  let totalSize = 0;
  
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const entryPath = path.join(folderPath, entry.name);
      
      if (entry.isFile()) {
        const stats = await fs.stat(entryPath);
        totalSize += stats.size;
      } else if (entry.isDirectory()) {
        totalSize += await getFolderSize(entryPath);
      }
    }
  } catch (error) {
    console.error(`計算資料夾大小失敗: ${folderPath}`, error);
  }
  
  return totalSize;
}

// 輔助函數：創建世界備份
async function createWorldBackup(serverPath: string, backupFilePath: string, worlds: string[]): Promise<void> {
  try {
    const zip = new AdmZip();

    // 添加選定的世界到備份
    for (const worldName of worlds) {
      const worldPath = path.join(serverPath, worldName);
      try {
        const stats = await fs.stat(worldPath);
        if (stats.isDirectory()) {
          zip.addLocalFolder(worldPath, worldName);
        }
      } catch (error) {
        console.warn(`無法添加世界 ${worldName}:`, error);
      }
    }

    // 添加重要的伺服器檔案
    const serverFiles = [
      'server.properties',
      'whitelist.json',
      'banned-players.json',
      'banned-ips.json',
      'ops.json',
      'usercache.json'
    ];

    for (const fileName of serverFiles) {
      const filePath = path.join(serverPath, fileName);
      try {
        await fs.access(filePath);
        zip.addLocalFile(filePath);
      } catch {
        // 檔案不存在，跳過
      }
    }

    // 寫入zip檔案
    zip.writeZip(backupFilePath);
    console.log('備份完成:', backupFilePath);
  } catch (error) {
    console.error('創建備份失敗:', error);
    throw error;
  }
}

// 輔助函數：還原世界備份
async function restoreWorldBackup(backupFilePath: string, serverPath: string): Promise<void> {
  try {
    const zip = new AdmZip(backupFilePath);
    zip.extractAllTo(serverPath, true);
    console.log('備份還原完成');
  } catch (error) {
    console.error('還原備份時發生錯誤:', error);
    throw error;
  }
}