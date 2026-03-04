import { app, BrowserWindow, Menu, shell, ipcMain, dialog } from 'electron';
import { join } from 'path';
import { isDev, platform } from './utils/platform';
import { setupIPC } from './ipc/setupIPC';
import { ServerManager } from './services/ServerManager';
import { SettingsManager } from './utils/SettingsManager';
import { type LanguageCode } from '../shared/i18n';

class MinecraftServerManager {
  private mainWindow: BrowserWindow | null = null;
  private serverManager: ServerManager;
  private settingsManager: SettingsManager;
  private currentLanguage: LanguageCode = 'zh-TW';

  constructor() {
    this.serverManager = new ServerManager();
    this.settingsManager = new SettingsManager();
    this.init();
  }

  private async init(): Promise<void> {
    await app.whenReady();
    
    // 載入設定並獲取當前語言
    const settings = await this.settingsManager.loadSettings();
    this.currentLanguage = settings.language;
    
    this.createWindow();
    this.setupEventHandlers();
    this.setMinecraftManagerReference();
    this.setupIPC();
    this.createMenu();
  }

  private createWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, '../preload/preload.cjs')
      },
      show: false,
      titleBarStyle: platform === 'darwin' ? 'hiddenInset' : 'default',
      icon: join(__dirname, '../../assets/icon.png')
    });

    if (isDev) {
      // 開發模式：使用環境變數或嘗試多個端口
      const devPort = process.env.VITE_DEV_PORT || 5173;
      this.mainWindow.loadURL(`http://localhost:${devPort}`);
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // 處理外部連結
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });
  }

  private setupEventHandlers(): void {
    app.on('window-all-closed', () => {
      if (platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });

    // 處理應用程式退出
    app.on('before-quit', async (event) => {
      if (this.serverManager.hasRunningServers()) {
        event.preventDefault();
        
        const result = await dialog.showMessageBox(this.mainWindow!, {
          type: 'warning',
          buttons: ['強制退出', '停止伺服器後退出', '取消'],
          defaultId: 1,
          title: '確認退出',
          message: '仍有伺服器正在運行',
          detail: '您想要如何處理正在運行的伺服器？'
        });

        if (result.response === 0) {
          // 強制退出
          this.serverManager.forceStopAllServers();
          app.quit();
        } else if (result.response === 1) {
          // 優雅停止後退出
          await this.serverManager.stopAllServers();
          app.quit();
        }
        // response === 2 代表取消，不做任何動作
      }
    });
  }

  private setupIPC(): void {
    setupIPC(this.serverManager, this.mainWindow);
  }

  public setMinecraftManagerReference(): void {
    // 這個方法用於在 IPC 設置中引用 MinecraftManager 實例
    (global as any).minecraftManager = this;
  }

  private createMenu(): void {
    const template = this.getMenuTemplate();
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  private getMenuTemplate(): Electron.MenuItemConstructorOptions[] {
    const menuLabels = this.getMenuLabels();
    
    return [
      {
        label: menuLabels.file,
        submenu: [
          {
            label: menuLabels.openServerDirectory,
            accelerator: 'CmdOrCtrl+O',
            click: () => {
              this.mainWindow?.webContents.send('menu-open-server-directory');
            }
          },
          { type: 'separator' },
          {
            label: platform === 'darwin' ? menuLabels.quit : menuLabels.exit,
            accelerator: platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              app.quit();
            }
          }
        ]
      },
      {
        label: menuLabels.server,
        submenu: [
          {
            label: menuLabels.startServer,
            accelerator: 'CmdOrCtrl+S',
            click: () => {
              this.mainWindow?.webContents.send('menu-start-server');
            }
          },
          {
            label: menuLabels.stopServer,
            accelerator: 'CmdOrCtrl+T',
            click: () => {
              this.mainWindow?.webContents.send('menu-stop-server');
            }
          },
          { type: 'separator' },
          {
            label: menuLabels.restartServer,
            accelerator: 'CmdOrCtrl+R',
            click: () => {
              this.mainWindow?.webContents.send('menu-restart-server');
            }
          }
        ]
      },
      {
        label: menuLabels.view,
        submenu: [
          { 
            label: menuLabels.reload, 
            role: 'reload' 
          },
          { 
            label: menuLabels.forceReload, 
            role: 'forceReload' 
          },
          { 
            label: menuLabels.toggleDevTools, 
            role: 'toggleDevTools' 
          },
          { type: 'separator' },
          { 
            label: menuLabels.resetZoom, 
            role: 'resetZoom' 
          },
          { 
            label: menuLabels.zoomIn, 
            role: 'zoomIn' 
          },
          { 
            label: menuLabels.zoomOut, 
            role: 'zoomOut' 
          },
          { type: 'separator' },
          { 
            label: menuLabels.toggleFullscreen, 
            role: 'togglefullscreen' 
          }
        ]
      },
      {
        label: menuLabels.help,
        submenu: [
          {
            label: menuLabels.about,
            click: () => {
              const aboutTitle = this.currentLanguage === 'zh-TW' ? '關於 Minecraft 伺服器管理工具' :
                               this.currentLanguage === 'zh-CN' ? '关于 Minecraft 服务器管理工具' :
                               'About Minecraft Server Manager';
              
              const aboutMessage = this.currentLanguage === 'zh-TW' ? 'Minecraft 伺服器管理工具' :
                                 this.currentLanguage === 'zh-CN' ? 'Minecraft 服务器管理工具' :
                                 'Minecraft Server Manager';
              
              const aboutDetail = this.currentLanguage === 'zh-TW' ? '版本 1.0.0\n\n現代化的 Minecraft 伺服器管理應用程式' :
                                this.currentLanguage === 'zh-CN' ? '版本 1.0.0\n\n现代化的 Minecraft 服务器管理应用程序' :
                                'Version 1.0.0\n\nA modern Minecraft server management application';
              
              dialog.showMessageBox(this.mainWindow!, {
                type: 'info',
                title: aboutTitle,
                message: aboutMessage,
                detail: aboutDetail
              });
            }
          }
        ]
      }
    ];
  }

  private getMenuLabels(): Record<string, string> {
    const labels: Record<string, string> = {
      file: 'File',
      server: 'Server',
      view: 'View',
      help: 'Help',
      openServerDirectory: 'Open Server Directory',
      startServer: 'Start Server',
      stopServer: 'Stop Server',
      restartServer: 'Restart Server',
      quit: 'Quit',
      exit: 'Exit',
      about: 'About',
      reload: 'Reload',
      forceReload: 'Force Reload',
      toggleDevTools: 'Toggle Developer Tools',
      resetZoom: 'Reset Zoom',
      zoomIn: 'Zoom In',
      zoomOut: 'Zoom Out',
      toggleFullscreen: 'Toggle Fullscreen'
    };

    // 根據當前語言返回對應的翻譯
    switch (this.currentLanguage) {
      case 'zh-TW':
        return {
          file: '檔案',
          server: '伺服器',
          view: '檢視',
          help: '說明',
          openServerDirectory: '開啟伺服器目錄',
          startServer: '啟動伺服器',
          stopServer: '停止伺服器',
          restartServer: '重新啟動伺服器',
          quit: '結束',
          exit: '離開',
          about: '關於',
          reload: '重新載入',
          forceReload: '強制重新載入',
          toggleDevTools: '切換開發者工具',
          resetZoom: '重置縮放',
          zoomIn: '放大',
          zoomOut: '縮小',
          toggleFullscreen: '切換全螢幕'
        };
      case 'zh-CN':
        return {
          file: '文件',
          server: '服务器',
          view: '查看',
          help: '帮助',
          openServerDirectory: '打开服务器目录',
          startServer: '启动服务器',
          stopServer: '停止服务器',
          restartServer: '重启服务器',
          quit: '退出',
          exit: '退出',
          about: '关于',
          reload: '重新加载',
          forceReload: '强制重新加载',
          toggleDevTools: '切换开发者工具',
          resetZoom: '重置缩放',
          zoomIn: '放大',
          zoomOut: '缩小',
          toggleFullscreen: '切换全屏'
        };
      case 'en-US':
      default:
        return labels;
    }
  }

  public updateMenuLanguage(language: LanguageCode): void {
    this.currentLanguage = language;
    this.createMenu();
  }

  public getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }
}

// 建立應用程式實例
const minecraftManager = new MinecraftServerManager();