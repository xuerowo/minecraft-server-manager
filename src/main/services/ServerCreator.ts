import { EventEmitter } from 'events';
import { createWriteStream, promises as fs } from 'fs';
import { join, dirname } from 'path';
import { pipeline } from 'stream/promises';
import { ServerCreationConfig, CreationProgress, ServerType } from '../../shared/types';
import { ServerVersionManager } from './ServerVersionManager';
import { getJavaExecutable } from '../utils/platform';

export class ServerCreator extends EventEmitter {
  private versionManager: ServerVersionManager;

  constructor() {
    super();
    this.versionManager = new ServerVersionManager();
  }

  public async createServer(config: ServerCreationConfig, serverBasePath: string): Promise<void> {
    const serverPath = join(serverBasePath, `${config.version}-${config.name}`);
    
    try {
      this.emitProgress('downloading', 0, '開始建立伺服器...');

      // 創建伺服器目錄
      await fs.mkdir(serverPath, { recursive: true });

      // 下載伺服器檔案
      await this.downloadServerJar(config.type, config.version, serverPath);

      // 先接受 EULA（建立 eula.txt）
      await this.acceptEULA(serverPath);

      // 讓 server.jar 在首次運行時自動生成配置檔案
      await this.generateServerConfig(serverPath, config.type);

      // 生成啟動腳本（可選）
      if (config.type !== 'spigot') { // Spigot 需要額外處理
        await this.generateStartScript(config, serverPath);
      }

      this.emitProgress('completed', 100, '伺服器創建完成！');
      this.emit('serverCreated', { config, path: serverPath });

    } catch (error) {
      this.emitProgress('error', 0, '創建伺服器時發生錯誤', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async downloadServerJar(type: ServerType, version: string, serverPath: string): Promise<void> {
    this.emitProgress('downloading', 10, `正在獲取 ${type} ${version} 的下載連結...`);

    try {
      const downloadUrl = await this.versionManager.getDownloadUrl(type, version);
      
      this.emitProgress('downloading', 20, `正在下載 ${type} 伺服器檔案...`);

      let jarFileName = 'server.jar';
      if (type === 'spigot') {
        jarFileName = 'BuildTools.jar';
      } else if (type === 'fabric') {
        jarFileName = 'fabric-server.jar';
      } else if (type === 'forge') {
        jarFileName = 'forge-installer.jar';
      }

      const jarPath = join(serverPath, jarFileName);
      
      // 下載檔案
      const response = await fetch(downloadUrl, {
        headers: {
          'User-Agent': 'minecraft-server-manager/1.0.0 (https://github.com/yourname/minecraft-server-manager)'
        }
      });

      if (!response.ok) {
        throw new Error(`下載失敗: ${response.statusText}`);
      }

      const totalSize = parseInt(response.headers.get('content-length') || '0');
      let downloadedSize = 0;

      const fileStream = createWriteStream(jarPath);
      
      if (response.body) {
        const reader = response.body.getReader();
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            fileStream.write(Buffer.from(value));
            downloadedSize += value.length;
            
            const progress = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 60) + 20 : 50;
            this.emitProgress('downloading', progress, `正在下載... ${this.formatBytes(downloadedSize)}/${this.formatBytes(totalSize)}`);
          }
        } finally {
          reader.releaseLock();
        }
      }

      fileStream.end();
      
      // 等待寫入完成
      await new Promise<void>((resolve, reject) => {
        fileStream.on('finish', () => resolve());
        fileStream.on('error', reject);
      });

      this.emitProgress('downloading', 80, '下載完成');

      // 處理特殊類型的伺服器
      if (type === 'spigot') {
        await this.buildSpigotServer(serverPath, version);
      } else if (type === 'forge') {
        await this.installForgeServer(serverPath, version);
      }

    } catch (error) {
      throw new Error(`下載 ${type} 伺服器失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async buildSpigotServer(serverPath: string, version: string): Promise<void> {
    this.emitProgress('configuring', 85, '正在構建 Spigot 伺服器...');
    
    // 注意：實際構建 Spigot 需要運行 BuildTools.jar
    // 這是一個耗時的過程，這裡只做示例
    await fs.writeFile(
      join(serverPath, 'spigot-build-instructions.txt'),
      `請手動運行以下命令來構建 Spigot 伺服器：
java -jar BuildTools.jar --rev ${version}

構建完成後，生成的 spigot-${version}.jar 檔案就是伺服器檔案。`
    );
  }

  private async installForgeServer(serverPath: string, version: string): Promise<void> {
    this.emitProgress('configuring', 85, '正在配置 Forge 伺服器...');
    
    // 注意：實際安裝 Forge 需要運行 forge-installer.jar
    // 這裡只做示例
    await fs.writeFile(
      join(serverPath, 'forge-install-instructions.txt'),
      `請手動運行以下命令來安裝 Forge 伺服器：
java -jar forge-installer.jar --installServer

安裝完成後會生成相應的伺服器啟動檔案。`
    );
  }


  private async acceptEULA(serverPath: string): Promise<void> {
    this.emitProgress('configuring', 95, '正在接受 EULA...');

    const eulaContent = [
      '# By changing the setting below to TRUE you are indicating your agreement to our EULA (https://account.mojang.com/documents/minecraft_eula)',
      `# ${new Date().toISOString()}`,
      'eula=true'
    ];

    await fs.writeFile(join(serverPath, 'eula.txt'), eulaContent.join('\n'));
  }

  private async generateStartScript(config: ServerCreationConfig, serverPath: string): Promise<void> {
    // Windows 批次檔案
    const batContent = [
      '@echo off',
      'title Minecraft Server',
      `java ${config.javaArgs?.join(' ') || ''} -Xms${config.minMemory} -Xmx${config.maxMemory} -jar server.jar nogui`,
      'pause'
    ];

    await fs.writeFile(join(serverPath, 'start.bat'), batContent.join('\r\n'));

    // Unix shell 腳本
    const shContent = [
      '#!/bin/bash',
      '# Minecraft Server Start Script',
      '',
      `java ${config.javaArgs?.join(' ') || ''} -Xms${config.minMemory} -Xmx${config.maxMemory} -jar server.jar nogui`,
      ''
    ];

    await fs.writeFile(join(serverPath, 'start.sh'), shContent.join('\n'));
    
    // 為 shell 腳本添加執行權限 (在 Unix 系統上)
    try {
      await fs.chmod(join(serverPath, 'start.sh'), 0o755);
    } catch (error) {
      // 在 Windows 上會失敗，忽略錯誤
    }
  }

  private emitProgress(step: CreationProgress['step'], progress: number, message: string, error?: string): void {
    const progressData: CreationProgress = {
      step,
      progress,
      message,
      error
    };
    
    this.emit('progress', progressData);
  }

  private async generateServerConfig(serverPath: string, serverType: ServerType): Promise<void> {
    // 對於特殊類型的伺服器（Spigot、Fabric、Forge），跳過自動配置生成
    if (serverType === 'spigot' || serverType === 'fabric' || serverType === 'forge') {
      this.emitProgress('configuring', 85, `${serverType} 伺服器需要手動配置，跳過自動生成`);
      return;
    }

    this.emitProgress('configuring', 85, '首次運行伺服器以生成所有配置檔案...');

    const { spawn } = require('child_process');
    const { join } = require('path');
    const { existsSync, readdir } = require('fs');

    // 尋找伺服器 jar 檔案
    let jarPath: string;
    try {
      const files = await fs.readdir(serverPath);
      // 尋找 jar 檔案，優先選擇包含 "server" 的檔案，否則選擇第一個 jar 檔案
      let jarFile = files.find(file => file.endsWith('.jar') && file.includes('server'));
      if (!jarFile) {
        jarFile = files.find(file => file.endsWith('.jar'));
      }

      if (!jarFile) {
        this.emitProgress('configuring', 90, '未找到伺服器 jar 檔案，跳過配置生成');
        return;
      }

      jarPath = join(serverPath, jarFile);
    } catch (error) {
      this.emitProgress('configuring', 90, '讀取目錄失敗，跳過配置生成');
      return;
    }

    return new Promise<void>((resolve, reject) => {
      // 啟動伺服器來生成配置檔案
      const process = spawn(getJavaExecutable(), ['-Xms512M', '-Xmx1G', '-jar', jarPath, 'nogui'], {
        cwd: serverPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let allConfigsGenerated = false;
      let stopSent = false;
      let serverReady = false;

      // 檢查所有必要的配置檔案是否已生成
      const checkAllConfigs = () => {
        const requiredFiles = [
          'server.properties',
          'logs/latest.log',
          'usercache.json'
        ];

        const optionalFiles = [
          'ops.json',
          'whitelist.json',
          'banned-players.json',
          'banned-ips.json'
        ];

        // 檢查必要檔案（eula.txt 已經在之前建立了）
        const allRequiredExist = requiredFiles.every(file =>
          existsSync(join(serverPath, file))
        );

        // 檢查至少一個可選檔案（表示伺服器已完成初始化）
        const someOptionalExist = optionalFiles.some(file =>
          existsSync(join(serverPath, file))
        );

        if (allRequiredExist && (someOptionalExist || serverReady)) {
          allConfigsGenerated = true;

          // 發送停止指令
          if (!stopSent && process.stdin.writable) {
            stopSent = true;
            this.emitProgress('configuring', 88, '所有配置檔案生成完成，正在停止伺服器...');
            process.stdin.write('stop\n');

            // 等待伺服器停止
            setTimeout(() => {
              if (!process.killed) {
                process.kill();
              }
              resolve();
            }, 5000);
          }
        }
      };

      // 定期檢查配置檔案
      const configCheckInterval = setInterval(checkAllConfigs, 1000);

      // 處理輸出
      process.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('伺服器輸出:', output.trim());

        // 當伺服器準備好時設置標誌並檢查配置
        if (output.includes('Done') || output.includes('準備就緒') || output.includes('For help')) {
          serverReady = true;
          checkAllConfigs();
        }

        // 如果伺服器啟動失敗，直接停止
        if (output.includes('FAILED') || output.includes('錯誤') || output.includes('Error')) {
          clearInterval(configCheckInterval);
          process.kill();
          reject(new Error('伺服器啟動失敗，無法生成配置檔案'));
        }
      });

      process.stderr.on('data', (data) => {
        const error = data.toString();
        console.error('伺服器錯誤:', error.trim());

        // 忽略一些常見的非錯誤訊息
        if (!error.includes('WARN') && !error.includes('INFO')) {
          console.error('伺服器嚴重錯誤:', error);
        }
      });

      process.on('close', (code) => {
        clearInterval(configCheckInterval);

        if (allConfigsGenerated) {
          this.emitProgress('configuring', 90, '所有配置檔案生成完成');
          resolve();
        } else if (code !== 0) {
          reject(new Error(`伺服器異常退出，代碼: ${code}`));
        } else {
          // 正常退出但沒有生成所有配置，檢查哪些檔案已經存在
          const requiredFiles = ['server.properties', 'logs/latest.log', 'usercache.json'];
          const existingFiles = requiredFiles.filter(file => existsSync(join(serverPath, file)));

          if (existingFiles.length > 0) {
            this.emitProgress('configuring', 90, `部分配置檔案已生成: ${existingFiles.join(', ')}`);
            resolve();
          } else {
            reject(new Error('伺服器正常退出但未生成任何配置檔案'));
          }
        }
      });

      process.on('error', (error) => {
        clearInterval(configCheckInterval);
        reject(new Error(`啟動伺服器失敗: ${error.message}`));
      });

      // 設置超時（60秒）
      setTimeout(() => {
        if (!allConfigsGenerated) {
          clearInterval(configCheckInterval);
          process.kill();
          reject(new Error('生成配置檔案超時'));
        }
      }, 60000);
    });
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}