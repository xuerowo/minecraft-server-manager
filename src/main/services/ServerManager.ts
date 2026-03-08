import { spawn, ChildProcess } from 'child_process';
import { join, resolve, dirname } from 'path';
import { readdir, stat, readFile, writeFile, access, mkdir, rm, cp } from 'fs/promises';
import { EventEmitter } from 'events';
import { getJavaExecutable, isWin } from '../utils/platform';
import { ServerCreator } from './ServerCreator';
import { ServerVersionManager } from './ServerVersionManager';
import { ServerCreationConfig, ServerType, AvailableVersion, ServerTypeInfo, WorldInfo } from '../../shared/types';

export interface ServerInfo {
  id: string;
  name: string;
  version: string;
  path: string;
  status: 'stopped' | 'starting' | 'running' | 'stopping';
  playerCount?: number;
  maxPlayers?: number;
  lastStart?: Date;
}

export interface ServerProperties {
  [key: string]: string | number | boolean;
}

// 玩家相關介面定義
export interface PlayerCacheEntry {
  name: string;
  uuid: string;
  expiresOn: string;
}

export interface OpsEntry {
  uuid: string;
  name: string;
  level: number;
  bypassesPlayerLimit: boolean;
}

export interface WhitelistEntry {
  uuid: string;
  name: string;
}

export interface BannedPlayerEntry {
  uuid: string;
  name: string;
  created: string;
  source: string;
  expires?: string;
  reason: string;
}

export interface BannedIPEntry {
  ip: string;
  created: string;
  source: string;
  expires?: string;
  reason: string;
}

export interface PlayerInfo {
  uuid: string;
  username: string;
  lastSeen?: Date;
  online: boolean;
  isOp: boolean;
  playTime?: number;
}

export interface PlayerManagementData {
  players: PlayerInfo[];
  ops: OpsEntry[];
  whitelist: WhitelistEntry[];
  bannedPlayers: BannedPlayerEntry[];
  bannedIPs: BannedIPEntry[];
}

export class ServerInstance extends EventEmitter {
  public info: ServerInfo;
  private process: ChildProcess | null = null;
  private logBuffer: string[] = [];
  private readonly maxLogLines = 1000;

  constructor(serverInfo: ServerInfo) {
    super();
    this.info = serverInfo;
  }

  public async start(javaArgs: string[] = []): Promise<void> {
    if (this.info.status === 'running' || this.info.status === 'starting') {
      throw new Error('伺服器已在運行或正在啟動中');
    }

    this.info.status = 'starting';
    this.info.lastStart = new Date();
    this.emit('statusChanged', this.info);

    try {
      const jarPath = await this.findServerJar();
      const defaultArgs = [
        '-Xms1G',
        '-Xmx2G',
        '-jar',
        jarPath,
        'nogui'
      ];
      
      const args = [...javaArgs, ...defaultArgs];
      
      this.process = spawn(getJavaExecutable(), args, {
        cwd: this.info.path,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.setupProcessHandlers();
      
    } catch (error) {
      this.info.status = 'stopped';
      this.emit('statusChanged', this.info);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    console.log(`[ServerInstance] 呼叫停止伺服器: ${this.info.id}, 當前狀態: ${this.info.status}`);
    
    // 如果已經是停止狀態，確保 process 為 null
    if (this.info.status === 'stopped') {
      console.log(`[ServerInstance] 伺服器 ${this.info.id} 已經停止，確保清理行程`);
      this.process = null;
      return;
    }

    this.info.status = 'stopping';
    this.emit('statusChanged', this.info);

    // 強制清理狀態的保險
    const forceCleanup = () => {
      if (this.info.status !== 'stopped') {
        console.log(`[ServerInstance] 伺服器 ${this.info.id} 強制同步為停止狀態`);
        this.info.status = 'stopped';
        this.emit('statusChanged', this.info);
        this.process = null;
      }
    };

    if (!this.process) {
      console.log(`[ServerInstance] 伺服器 ${this.info.id} 沒有執行中的行程，直接更新狀態`);
      forceCleanup();
      return;
    }

    // 啟動超時保險
    const timeout = 10000; 
    const timer = setTimeout(() => {
      console.log(`[ServerInstance] 伺服器 ${this.info.id} 停止超時，執行強制結束`);
      this.killProcess();
      forceCleanup();
    }, timeout);

    // 當進程結束時清除計時器
    if (this.process) {
      const clearTimer = () => clearTimeout(timer);
      this.process.once('close', clearTimer);
      this.process.once('exit', clearTimer);
    }

    try {
      if (this.process.stdin && this.process.stdin.writable) {
        console.log(`[ServerInstance] 向伺服器 ${this.info.id} 發送 stop 指令`);
        this.process.stdin.write('stop\r\n');
      } else {
        console.log(`[ServerInstance] 伺服器 ${this.info.id} stdin 不可用，嘗試 kill`);
        this.killProcess();
      }
    } catch (error) {
      console.error(`[ServerInstance] 執行停止動作時出錯:`, error);
      this.killProcess();
      forceCleanup();
    }
  }

  /**
   * 強制終止行程
   */
  private killProcess(): void {
    if (!this.process || this.process.killed) return;
    
    try {
      if (isWin && this.process.pid) {
        // Windows 特殊處理：強制結束整個進程樹
        console.log(`[ServerInstance] Windows 環境，執行 taskkill PID: ${this.process.pid}`);
        const tk = spawn('taskkill', ['/F', '/T', '/PID', this.process.pid.toString()]);
        tk.on('error', (err) => {
          console.error(`[ServerInstance] taskkill 執行錯誤:`, err);
          try { this.process?.kill(); } catch {}
        });
      } else {
        this.process.kill('SIGKILL');
      }
    } catch (e) {
      console.error(`[ServerInstance] 強制結束行程失敗:`, e);
      // 最後嘗試普通 kill
      try { this.process.kill(); } catch {}
    }
  }

  public sendCommand(command: string): void {
    if (this.process && (this.info.status === 'running' || this.info.status === 'stopping')) {
      this.process.stdin?.write(`${command}\n`);
      this.emit('commandSent', command);
    }
  }

  public getLogs(lines?: number): string[] {
    const requestedLines = lines || this.maxLogLines;
    return this.logBuffer.slice(-requestedLines);
  }

  public getServerPath(): string {
    return this.info.path;
  }

  public getStatus(): string {
    return this.info.status;
  }

  private async findServerJar(): Promise<string> {
    const files = await readdir(this.info.path);
    const jarFiles = files.filter(file => file.endsWith('.jar') && file.includes('server'));
    
    if (jarFiles.length === 0) {
      throw new Error('找不到伺服器 JAR 檔案');
    }
    
    // 如果有多個 JAR 檔案，選擇最新的
    if (jarFiles.length > 1) {
      const jarStats = await Promise.all(
        jarFiles.map(async file => ({
          name: file,
          mtime: (await stat(join(this.info.path, file))).mtime
        }))
      );
      jarStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      return jarStats[0].name;
    }
    
    return jarFiles[0];
  }

  private setupProcessHandlers(): void {
    if (!this.process) return;

    this.process.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
        this.logBuffer.push(line);
        if (this.logBuffer.length > this.maxLogLines) {
          this.logBuffer.shift();
        }
        this.emit('log', line);
      });

      // 檢測伺服器啟動完成
      if (data.toString().includes('Done (') && data.toString().includes('s)! For help, type "help"')) {
        this.info.status = 'running';
        this.emit('statusChanged', this.info);
        this.emit('started');
      }
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
        this.logBuffer.push(`[ERROR] ${line}`);
        if (this.logBuffer.length > this.maxLogLines) {
          this.logBuffer.shift();
        }
        this.emit('log', `[ERROR] ${line}`);
      });
    });

    this.process.on('close', (code) => {
      const stopMessage = `[SERVER] 伺服器已停止，退出碼: ${code}`;
      console.log(stopMessage);
      this.logBuffer.push(stopMessage);
      if (this.logBuffer.length > this.maxLogLines) {
        this.logBuffer.shift();
      }
      this.emit('log', stopMessage);
      
      this.info.status = 'stopped';
      this.emit('statusChanged', this.info);
      this.emit('stopped', code);
      this.process = null;
    });

    this.process.on('exit', (code) => {
      console.log(`[SERVER] 伺服器行程退出，退出碼: ${code}`);
      if (this.info.status !== 'stopped') {
        this.info.status = 'stopped';
        this.emit('statusChanged', this.info);
        this.process = null;
      }
    });

    this.process.on('error', (error) => {
      this.info.status = 'stopped';
      this.emit('statusChanged', this.info);
      this.emit('error', error);
    });
  }
}

export class ServerManager extends EventEmitter {
  private servers = new Map<string, ServerInstance>();
  private serverBasePath: string;
  private serverCreator: ServerCreator;
  private versionManager: ServerVersionManager;

  constructor(serverBasePath?: string) {
    super();
    this.serverBasePath = serverBasePath || join(process.cwd(), 'servers');
    this.serverCreator = new ServerCreator();
    this.versionManager = new ServerVersionManager();
    
    // 轉發創建進度事件
    this.serverCreator.on('progress', (progress) => {
      this.emit('creationProgress', progress);
    });
    
    this.serverCreator.on('serverCreated', (data) => {
      this.emit('serverCreated', data);
    });
  }

  public async scanServers(): Promise<ServerInfo[]> {
    try {
      this.safeConsoleLog(`[ServerManager] 開始掃描伺服器目錄: ${this.serverBasePath}`);
      const entries = await readdir(this.serverBasePath);
      this.safeConsoleLog(`[ServerManager] 找到目錄項目: [${entries.join(', ')}]`);
      const serverInfos: ServerInfo[] = [];

      for (const entry of entries) {
        const serverPath = join(this.serverBasePath, entry);
        const stats = await stat(serverPath);
        
        if (stats.isDirectory()) {
          this.safeConsoleLog(`[ServerManager] 解析目錄:`, entry, `(路徑: ${serverPath})`);
          const serverInfo = await this.parseServerDirectory(entry, serverPath);
          if (serverInfo) {
            this.safeConsoleLog('[ServerManager] 成功解析伺服器:', {
              id: serverInfo.id,
              name: serverInfo.name,
              version: serverInfo.version,
              status: serverInfo.status
            });
            serverInfos.push(serverInfo);
          } else {
            this.safeConsoleLog(`[ServerManager] 跳過目錄 ${entry} (不是有效的伺服器目錄)`);
          }
        }
      }

      this.safeConsoleLog('[ServerManager] 掃描完成，找到', serverInfos.length, '個伺服器');
      return serverInfos;
    } catch (error) {
      this.safeConsoleError('掃描伺服器目錄時發生錯誤:', error);
      // 返回空陣列而不是拋出錯誤，避免前端顯示失敗訊息
      return [];
    }
  }

  public async scanServersFromPath(customPath: string): Promise<ServerInfo[]> {
    try {
      this.safeConsoleLog(`[ServerManager] 開始掃描自訂伺服器目錄: ${customPath}`);
      
      // 檢查目錄是否存在
      try {
        await access(customPath);
      } catch {
        this.safeConsoleError(`[ServerManager] 目錄不存在: ${customPath}`);
        throw new Error(`目錄不存在: ${customPath}`);
      }
      
      const entries = await readdir(customPath);
      this.safeConsoleLog(`[ServerManager] 找到目錄項目: [${entries.join(', ')}]`);
      const serverInfos: ServerInfo[] = [];

      for (const entry of entries) {
        const serverPath = join(customPath, entry);
        const stats = await stat(serverPath);
        
        if (stats.isDirectory()) {
          this.safeConsoleLog(`[ServerManager] 解析目錄:`, entry, `(路徑: ${serverPath})`);
          const serverInfo = await this.parseServerDirectory(entry, serverPath);
          if (serverInfo) {
            this.safeConsoleLog('[ServerManager] 成功解析伺服器:', {
              id: serverInfo.id,
              name: serverInfo.name,
              version: serverInfo.version,
              status: serverInfo.status
            });
            serverInfos.push(serverInfo);
          } else {
            this.safeConsoleLog(`[ServerManager] 跳過目錄 ${entry} (不是有效的伺服器目錄)`);
          }
        }
      }

      this.safeConsoleLog('[ServerManager] 自訂路徑掃描完成，找到', serverInfos.length, '個伺服器');
      return serverInfos;
    } catch (error) {
      this.safeConsoleError('掃描自訂伺服器目錄時發生錯誤:', error);
      // 返回空陣列而不是拋出錯誤，避免前端顯示失敗訊息
      return [];
    }
  }

  private async parseServerDirectory(dirName: string, serverPath: string): Promise<ServerInfo | null> {
    try {
      // 檢查是否有 server.jar 或包含 server 的 jar 檔案
      const files = await readdir(serverPath);
      const hasServerJar = files.some(file => file.endsWith('.jar') && file.includes('server'));
      
      if (!hasServerJar) {
        return null; // 不是有效的伺服器目錄
      }

      // 解析目錄名稱獲取版本信息
      const parts = dirName.split('-');
      const version = parts[0] || 'unknown';
      const name = parts.slice(1).join('-') || dirName;

      return {
        id: dirName,
        name,
        version,
        path: serverPath,
        status: 'stopped'
      };
    } catch (error) {
      this.safeConsoleError(`解析伺服器目錄 ${dirName} 時發生錯誤:`, error);
      return null;
    }
  }

  public getServer(serverId: string): ServerInstance | undefined {
    return this.servers.get(serverId);
  }

  public async loadServer(serverId: string): Promise<ServerInstance> {
    this.safeConsoleLog(`[ServerManager] 載入伺服器: ${serverId}`);
    
    if (this.servers.has(serverId)) {
      this.safeConsoleLog(`[ServerManager] 伺服器已在快取中: ${serverId}`);
      return this.servers.get(serverId)!;
    }

    this.safeConsoleLog(`[ServerManager] 伺服器不在快取中，開始掃描...`);
    const allServers = await this.scanServers();
    this.safeConsoleLog(`[ServerManager] 掃描結果 - 找到伺服器列表: [${allServers.map(s => s.id).join(', ')}]`);
    this.safeConsoleLog(`[ServerManager] 尋找伺服器ID: "${serverId}"`);
    
    const serverInfo = allServers.find(server => server.id === serverId);
    
    if (!serverInfo) {
      if (allServers.length === 0) {
        this.safeConsoleError(`[ServerManager] 找不到任何伺服器，請檢查伺服器目錄: ${this.serverBasePath}`);
        throw new Error(`找不到任何伺服器，請檢查伺服器目錄是否存在`);
      } else {
        this.safeConsoleError(`[ServerManager] 找不到伺服器: ${serverId}`);
        this.safeConsoleError(`[ServerManager] 可用的伺服器ID: [${allServers.map(s => s.id).join(', ')}]`);
        throw new Error(`找不到伺服器: ${serverId}`);
      }
    }

    this.safeConsoleLog(`[ServerManager] 找到伺服器，創建實例: ${serverInfo.id}`);
    this.safeConsoleLog(`[ServerManager] 伺服器路徑: ${serverInfo.path}`);
    this.safeConsoleLog(`[ServerManager] 伺服器名稱: ${serverInfo.name}`);
    this.safeConsoleLog(`[ServerManager] 伺服器版本: ${serverInfo.version}`);
    
    const serverInstance = new ServerInstance(serverInfo);
    this.servers.set(serverId, serverInstance);
    
    // 轉發伺服器事件
    serverInstance.on('statusChanged', (info) => {
      this.emit('serverStatusChanged', info);
    });
    
    serverInstance.on('log', (log) => {
      this.emit('serverLog', serverId, log);
    });

    return serverInstance;
  }

  public hasRunningServers(): boolean {
    const servers = Array.from(this.servers.values());
    for (const server of servers) {
      if (server.info.status === 'running' || server.info.status === 'starting') {
        return true;
      }
    }
    return false;
  }

  public async stopAllServers(): Promise<void> {
    const stopPromises = Array.from(this.servers.values()).map(server => {
      if (server.info.status === 'running') {
        return server.stop();
      }
    });
    
    await Promise.all(stopPromises);
  }

  public forceStopAllServers(): void {
    const servers = Array.from(this.servers.values());
    for (const server of servers) {
      if (server.info.status === 'running' && (server as any).process) {
        (server as any).process.kill('SIGKILL');
      }
    }
  }

  public async readServerProperties(serverId: string): Promise<ServerProperties> {
    const server = await this.loadServer(serverId);
    const propertiesPath = join(server.info.path, 'server.properties');
    
    try {
      const content = await readFile(propertiesPath, 'utf-8');
      return this.parseProperties(content);
    } catch (error) {
      this.safeConsoleError('讀取 server.properties 失敗:', error);
      return {};
    }
  }

  public async writeServerProperties(serverId: string, properties: ServerProperties): Promise<void> {
    const server = await this.loadServer(serverId);
    const propertiesPath = join(server.info.path, 'server.properties');
    
    const content = this.stringifyProperties(properties);
    await writeFile(propertiesPath, content, 'utf-8');
  }

  public async updateServerProperties(serverId: string, updates: Partial<ServerProperties>): Promise<void> {
    const server = await this.loadServer(serverId);
    const propertiesPath = join(server.info.path, 'server.properties');
    
    try {
      // 讀取現有內容
      const existingContent = await readFile(propertiesPath, 'utf-8');
      const existingProperties = this.parseProperties(existingContent);
      
      // 合併更新
      const mergedProperties: ServerProperties = { ...existingProperties };
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          mergedProperties[key] = value;
        }
      });
      
      // 寫回檔案
      const newContent = this.stringifyProperties(mergedProperties);
      await writeFile(propertiesPath, newContent, 'utf-8');
    } catch (error) {
      this.safeConsoleError('更新 server.properties 失敗:', error);
      throw error;
    }
  }

  private parseProperties(content: string): ServerProperties {
    const properties: ServerProperties = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        
        // 嘗試解析為數字或布林值
        if (value === 'true' || value === 'false') {
          properties[key] = value === 'true';
        } else if (!isNaN(Number(value)) && value !== '') {
          properties[key] = Number(value);
        } else {
          properties[key] = value;
        }
      }
    }
    
    return properties;
  }

  private stringifyProperties(properties: ServerProperties): string {
    let content = '# Minecraft server properties\n';
    content += `# ${new Date().toISOString()}\n`;
    
    for (const [key, value] of Object.entries(properties)) {
      content += `${key}=${value}\n`;
    }
    
    return content;
  }

  // === 玩家管理相關方法 ===

  /**
   * 讀取 usercache.json 檔案
   */
  public async readUserCache(serverId: string): Promise<PlayerCacheEntry[]> {
    try {
      const server = await this.loadServer(serverId);
      const usercachePath = join(server.info.path, 'usercache.json');
      
      this.safeConsoleLog(`[ServerManager] 讀取 usercache.json - 伺服器: ${serverId}, 路徑: ${usercachePath}`);
      
      // 檢查檔案是否存在
      try {
        await access(usercachePath);
        this.safeConsoleLog(`[ServerManager] usercache.json 檔案存在: ${usercachePath}`);
      } catch {
        // 檔案不存在，創建空的 usercache.json
        this.safeConsoleLog(`[ServerManager] usercache.json 不存在，創建新檔案: ${usercachePath}`);
        await writeFile(usercachePath, JSON.stringify([], null, 2));
        return [];
      }
      
      const content = await readFile(usercachePath, 'utf-8');
      this.safeConsoleLog(`[ServerManager] usercache.json 檔案大小: ${content.length} 字元`);
      
      // 檢查是否為空檔案或無效內容
      if (!content.trim()) {
        this.safeConsoleLog(`[ServerManager] usercache.json 為空檔案`);
        return [];
      }
      
      try {
        const parsed = JSON.parse(content);
        const result = Array.isArray(parsed) ? parsed : [];
        this.safeConsoleLog(`[ServerManager] usercache.json 解析成功，找到 ${result.length} 個玩家記錄`);
        return result;
      } catch (parseError) {
        this.safeConsoleError(`解析 usercache.json 失敗 (${serverId}):`, parseError);
        this.safeConsoleError(`損壞的 usercache.json 內容: ${content.substring(0, 200)}...`);
        // 創建備份並返回空陣列
        await this.backupCorruptedFile(usercachePath, 'usercache');
        await writeFile(usercachePath, JSON.stringify([], null, 2));
        return [];
      }
    } catch (error) {
      this.safeConsoleError(`讀取 usercache.json 失敗 (${serverId}):`, error);
      return [];
    }
  }

  /**
   * 讀取 ops.json 檔案
   */
  public async readOps(serverId: string): Promise<OpsEntry[]> {
    try {
      const server = await this.loadServer(serverId);
      const opsPath = join(server.info.path, 'ops.json');
      
      this.safeConsoleLog(`[ServerManager] 讀取 ops.json - 伺服器: ${serverId}, 路徑: ${opsPath}`);
      
      // 檢查檔案是否存在
      try {
        await access(opsPath);
        this.safeConsoleLog(`[ServerManager] ops.json 檔案存在: ${opsPath}`);
      } catch {
        // 檔案不存在，創建空的 ops.json
        this.safeConsoleLog(`[ServerManager] ops.json 不存在，創建新檔案: ${opsPath}`);
        await writeFile(opsPath, JSON.stringify([], null, 2));
        return [];
      }
      
      const content = await readFile(opsPath, 'utf-8');
      this.safeConsoleLog(`[ServerManager] ops.json 檔案大小: ${content.length} 字元`);
      
      // 檢查是否為空檔案或無效內容
      if (!content.trim()) {
        this.safeConsoleLog(`[ServerManager] ops.json 為空檔案`);
        return [];
      }
      
      try {
        const parsed = JSON.parse(content);
        const result = Array.isArray(parsed) ? parsed : [];
        this.safeConsoleLog(`[ServerManager] ops.json 解析成功，找到 ${result.length} 個OP記錄`);
        return result;
      } catch (parseError) {
        this.safeConsoleError(`解析 ops.json 失敗 (${serverId}):`, parseError);
        this.safeConsoleError(`損壞的 ops.json 內容: ${content.substring(0, 200)}...`);
        // 創建備份並返回空陣列
        await this.backupCorruptedFile(opsPath, 'ops');
        await writeFile(opsPath, JSON.stringify([], null, 2));
        return [];
      }
    } catch (error) {
      this.safeConsoleError(`讀取 ops.json 失敗 (${serverId}):`, error);
      return [];
    }
  }

  /**
   * 讀取 whitelist.json 檔案
   */
  public async readWhitelist(serverId: string): Promise<WhitelistEntry[]> {
    try {
      const server = await this.loadServer(serverId);
      const whitelistPath = join(server.info.path, 'whitelist.json');
      
      this.safeConsoleLog(`[ServerManager] 讀取 whitelist.json - 伺服器: ${serverId}, 路徑: ${whitelistPath}`);
      
      // 檢查檔案是否存在
      try {
        await access(whitelistPath);
        this.safeConsoleLog(`[ServerManager] whitelist.json 檔案存在: ${whitelistPath}`);
      } catch {
        // 檔案不存在，創建空的 whitelist.json
        this.safeConsoleLog(`[ServerManager] whitelist.json 不存在，創建新檔案: ${whitelistPath}`);
        await writeFile(whitelistPath, JSON.stringify([], null, 2));
        return [];
      }
      
      const content = await readFile(whitelistPath, 'utf-8');
      this.safeConsoleLog(`[ServerManager] whitelist.json 檔案大小: ${content.length} 字元`);
      
      // 檢查是否為空檔案或無效內容
      if (!content.trim()) {
        this.safeConsoleLog(`[ServerManager] whitelist.json 為空檔案`);
        return [];
      }
      
      try {
        const parsed = JSON.parse(content);
        const result = Array.isArray(parsed) ? parsed : [];
        this.safeConsoleLog(`[ServerManager] whitelist.json 解析成功，找到 ${result.length} 個白名單記錄`);
        return result;
      } catch (parseError) {
        this.safeConsoleError(`解析 whitelist.json 失敗 (${serverId}):`, parseError);
        this.safeConsoleError(`損壞的 whitelist.json 內容: ${content.substring(0, 200)}...`);
        // 創建備份並返回空陣列
        await this.backupCorruptedFile(whitelistPath, 'whitelist');
        await writeFile(whitelistPath, JSON.stringify([], null, 2));
        return [];
      }
    } catch (error) {
      this.safeConsoleError(`讀取 whitelist.json 失敗 (${serverId}):`, error);
      return [];
    }
  }

  /**
   * 讀取 banned-players.json 檔案
   */
  public async readBannedPlayers(serverId: string): Promise<BannedPlayerEntry[]> {
    try {
      const server = await this.loadServer(serverId);
      const bannedPlayersPath = join(server.info.path, 'banned-players.json');
      
      this.safeConsoleLog(`[ServerManager] 讀取 banned-players.json - 伺服器: ${serverId}, 路徑: ${bannedPlayersPath}`);
      
      // 檢查檔案是否存在
      try {
        await access(bannedPlayersPath);
        this.safeConsoleLog(`[ServerManager] banned-players.json 檔案存在: ${bannedPlayersPath}`);
      } catch {
        // 檔案不存在，創建空的 banned-players.json
        this.safeConsoleLog(`[ServerManager] banned-players.json 不存在，創建新檔案: ${bannedPlayersPath}`);
        await writeFile(bannedPlayersPath, JSON.stringify([], null, 2));
        return [];
      }
      
      const content = await readFile(bannedPlayersPath, 'utf-8');
      this.safeConsoleLog(`[ServerManager] banned-players.json 檔案大小: ${content.length} 字元`);
      
      // 檢查是否為空檔案或無效內容
      if (!content.trim()) {
        this.safeConsoleLog(`[ServerManager] banned-players.json 為空檔案`);
        return [];
      }
      
      try {
        const parsed = JSON.parse(content);
        const result = Array.isArray(parsed) ? parsed : [];
        this.safeConsoleLog(`[ServerManager] banned-players.json 解析成功，找到 ${result.length} 個封禁玩家記錄`);
        return result;
      } catch (parseError) {
        this.safeConsoleError(`解析 banned-players.json 失敗 (${serverId}):`, parseError);
        this.safeConsoleError(`損壞的 banned-players.json 內容: ${content.substring(0, 200)}...`);
        // 創建備份並返回空陣列
        await this.backupCorruptedFile(bannedPlayersPath, 'banned-players');
        await writeFile(bannedPlayersPath, JSON.stringify([], null, 2));
        return [];
      }
    } catch (error) {
      this.safeConsoleError(`讀取 banned-players.json 失敗 (${serverId}):`, error);
      return [];
    }
  }

  /**
   * 讀取 banned-ips.json 檔案
   */
  public async readBannedIPs(serverId: string): Promise<BannedIPEntry[]> {
    try {
      const server = await this.loadServer(serverId);
      const bannedIPsPath = join(server.info.path, 'banned-ips.json');
      
      this.safeConsoleLog(`[ServerManager] 讀取 banned-ips.json - 伺服器: ${serverId}, 路徑: ${bannedIPsPath}`);
      
      // 檢查檔案是否存在
      try {
        await access(bannedIPsPath);
        this.safeConsoleLog(`[ServerManager] banned-ips.json 檔案存在: ${bannedIPsPath}`);
      } catch {
        // 檔案不存在，創建空的 banned-ips.json
        this.safeConsoleLog(`[ServerManager] banned-ips.json 不存在，創建新檔案: ${bannedIPsPath}`);
        await writeFile(bannedIPsPath, JSON.stringify([], null, 2));
        return [];
      }
      
      const content = await readFile(bannedIPsPath, 'utf-8');
      this.safeConsoleLog(`[ServerManager] banned-ips.json 檔案大小: ${content.length} 字元`);
      
      // 檢查是否為空檔案或無效內容
      if (!content.trim()) {
        this.safeConsoleLog(`[ServerManager] banned-ips.json 為空檔案`);
        return [];
      }
      
      try {
        const parsed = JSON.parse(content);
        const result = Array.isArray(parsed) ? parsed : [];
        this.safeConsoleLog(`[ServerManager] banned-ips.json 解析成功，找到 ${result.length} 個封禁IP記錄`);
        return result;
      } catch (parseError) {
        this.safeConsoleError(`解析 banned-ips.json 失敗 (${serverId}):`, parseError);
        this.safeConsoleError(`損壞的 banned-ips.json 內容: ${content.substring(0, 200)}...`);
        // 創建備份並返回空陣列
        await this.backupCorruptedFile(bannedIPsPath, 'banned-ips');
        await writeFile(bannedIPsPath, JSON.stringify([], null, 2));
        return [];
      }
    } catch (error) {
      this.safeConsoleError(`讀取 banned-ips.json 失敗 (${serverId}):`, error);
      return [];
    }
  }

  /**
   * 獲取完整的玩家管理數據
   */
  public async getPlayerManagementData(serverId: string): Promise<PlayerManagementData> {
    this.safeConsoleLog(`[ServerManager] 開始獲取玩家管理數據: ${serverId}`);
    
    try {
      // 並行讀取所有檔案，每個都有獨立的錯誤處理
      const [userCache, ops, whitelist, bannedPlayers, bannedIPs] = await Promise.all([
        this.readUserCache(serverId).catch(error => {
          this.safeConsoleError(`讀取用戶緩存失敗 (${serverId}):`, error);
          return [];
        }),
        this.readOps(serverId).catch(error => {
          this.safeConsoleError(`讀取OP列表失敗 (${serverId}):`, error);
          return [];
        }),
        this.readWhitelist(serverId).catch(error => {
          this.safeConsoleError(`讀取白名單失敗 (${serverId}):`, error);
          return [];
        }),
        this.readBannedPlayers(serverId).catch(error => {
          this.safeConsoleError(`讀取封禁玩家列表失敗 (${serverId}):`, error);
          return [];
        }),
        this.readBannedIPs(serverId).catch(error => {
          this.safeConsoleError(`讀取封禁IP列表失敗 (${serverId}):`, error);
          return [];
        })
      ]);

      this.safeConsoleLog(`[ServerManager] 玩家數據讀取完成 - 用戶緩存: ${userCache.length}, OP: ${ops.length}, 白名單: ${whitelist.length}, 封禁玩家: ${bannedPlayers.length}, 封禁IP: ${bannedIPs.length}`);

      // 組合成玩家資訊，添加額外的錯誤處理
      const players: PlayerInfo[] = [];
      
      for (const cache of userCache) {
        try {
          const isOp = ops.some(op => op.uuid === cache.uuid);
          
          players.push({
            uuid: cache.uuid,
            username: cache.name,
            lastSeen: new Date(cache.expiresOn),
            online: false, // 預設為離線，需要從伺服器狀態或日誌中獲取
            isOp,
            playTime: 0 // 需要從統計檔案或日誌中計算
          });
        } catch (playerError) {
          this.safeConsoleError(`處理玩家數據失敗 (${cache.name}):`, playerError);
          // 跳過有問題的玩家記錄
        }
      }

      this.safeConsoleLog(`[ServerManager] 玩家管理數據獲取成功，共 ${players.length} 個玩家`);

      return {
        players,
        ops,
        whitelist,
        bannedPlayers,
        bannedIPs
      };
    } catch (error) {
      this.safeConsoleError(`獲取玩家管理數據失敗 (${serverId}):`, error);
      return {
        players: [],
        ops: [],
        whitelist: [],
        bannedPlayers: [],
        bannedIPs: []
      };
    }
  }

  /**
   * 寫入 ops.json 檔案
   */
  public async writeOps(serverId: string, ops: OpsEntry[]): Promise<void> {
    try {
      const server = await this.loadServer(serverId);
      const opsPath = join(server.info.path, 'ops.json');
      
      const content = JSON.stringify(ops, null, 2);
      await writeFile(opsPath, content, 'utf-8');
    } catch (error) {
      this.safeConsoleError(`寫入 ops.json 失敗 (${serverId}):`, error);
      throw error;
    }
  }

  /**
   * 寫入 whitelist.json 檔案
   */
  public async writeWhitelist(serverId: string, whitelist: WhitelistEntry[]): Promise<void> {
    try {
      const server = await this.loadServer(serverId);
      const whitelistPath = join(server.info.path, 'whitelist.json');
      
      const content = JSON.stringify(whitelist, null, 2);
      await writeFile(whitelistPath, content, 'utf-8');
    } catch (error) {
      this.safeConsoleError(`寫入 whitelist.json 失敗 (${serverId}):`, error);
      throw error;
    }
  }

  /**
   * 寫入 banned-players.json 檔案
   */
  public async writeBannedPlayers(serverId: string, bannedPlayers: BannedPlayerEntry[]): Promise<void> {
    try {
      const server = await this.loadServer(serverId);
      const bannedPlayersPath = join(server.info.path, 'banned-players.json');
      
      const content = JSON.stringify(bannedPlayers, null, 2);
      await writeFile(bannedPlayersPath, content, 'utf-8');
    } catch (error) {
      this.safeConsoleError(`寫入 banned-players.json 失敗 (${serverId}):`, error);
      throw error;
    }
  }

  /**
   * 寫入 banned-ips.json 檔案
   */
  public async writeBannedIPs(serverId: string, bannedIPs: BannedIPEntry[]): Promise<void> {
    try {
      const server = await this.loadServer(serverId);
      const bannedIPsPath = join(server.info.path, 'banned-ips.json');
      
      const content = JSON.stringify(bannedIPs, null, 2);
      await writeFile(bannedIPsPath, content, 'utf-8');
    } catch (error) {
      this.safeConsoleError(`寫入 banned-ips.json 失敗 (${serverId}):`, error);
      throw error;
    }
  }

  /**
   * 備份損壞的檔案
   */
  private async backupCorruptedFile(filePath: string, fileType: string): Promise<void> {
    try {
      const backupDir = join(dirname(filePath), 'backups');
      await mkdir(backupDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `${fileType}_corrupted_${timestamp}.json`;
      const backupPath = join(backupDir, backupFileName);
      
      // 複製原始檔案到備份目錄
      const content = await readFile(filePath, 'utf-8');
      await writeFile(backupPath, content, 'utf-8');
      
      this.safeConsoleLog(`已備份損壞的 ${fileType}.json 檔案到: ${backupPath}`);
    } catch (backupError) {
      this.safeConsoleError(`備份損壞檔案失敗:`, backupError);
    }
  }

  /**
   * 檢查檔案是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 安全輸出中文訊息到控制台
   */
  private safeConsoleLog(message: string, ...args: any[]): void {
    try {
      // 確保所有參數都正確編碼
      const encodedArgs = args.map(arg => {
        if (typeof arg === 'string') {
          try {
            return Buffer.from(arg, 'utf8').toString('utf8');
          } catch {
            return arg;
          }
        }
        return arg;
      });
      
      // 確保訊息使用UTF-8編碼
      const encodedMessage = Buffer.from(message, 'utf8').toString('utf8');
      console.log(encodedMessage, ...encodedArgs);
    } catch (error) {
      // 如果編碼失敗，使用原始訊息
      console.log(message, ...args);
    }
  }

  /**
   * 診斷玩家數據檔案讀取功能
   */
  public async diagnosePlayerData(serverId: string): Promise<{
    success: boolean;
    details: {
      file: string;
      exists: boolean;
      readable: boolean;
      validJson: boolean;
      error?: string;
    }[];
  }> {
    const files = [
      'usercache.json',
      'ops.json', 
      'whitelist.json',
      'banned-players.json',
      'banned-ips.json'
    ];

    const results = [];
    
    try {
      const server = await this.loadServer(serverId);
      
      for (const file of files) {
        const filePath = join(server.info.path, file);
        const result: any = { file, exists: false, readable: false, validJson: false };
        
        try {
          // 檢查檔案是否存在
          await access(filePath);
          result.exists = true;
          
          // 嘗試讀取檔案
          const content = await readFile(filePath, 'utf-8');
          result.readable = true;
          
          // 嘗試解析JSON
          if (content.trim()) {
            JSON.parse(content);
            result.validJson = true;
          }
          
        } catch (error) {
          result.error = error instanceof Error ? error.message : String(error);
        }
        
        results.push(result);
      }
      
      const success = results.every(r => r.exists && r.readable && r.validJson);
      
      return { success, details: results };
      
    } catch (error) {
      return {
        success: false,
        details: files.map(file => ({
          file,
          exists: false,
          readable: false,
          validJson: false,
          error: '無法載入伺服器'
        }))
      };
    }
  }

  /**
   * 安全輸出中文錯誤訊息到控制台
   */
  private safeConsoleError(message: string, ...args: any[]): void {
    try {
      // 確保所有參數都正確編碼
      const encodedArgs = args.map(arg => {
        if (typeof arg === 'string') {
          try {
            return Buffer.from(arg, 'utf8').toString('utf8');
          } catch {
            return arg;
          }
        }
        return arg;
      });
      
      // 確保訊息使用UTF-8編碼
      const encodedMessage = Buffer.from(message, 'utf8').toString('utf8');
      console.error(encodedMessage, ...encodedArgs);
    } catch (error) {
      // 如果編碼失敗，使用原始訊息
      console.error(message, ...args);
    }
  }

  // === 伺服器創建相關方法 ===

  /**
   * 獲取所有支援的伺服器類型
   */
  public getServerTypes(): ServerTypeInfo[] {
    return this.versionManager.getServerTypes();
  }

  /**
   * 獲取指定伺服器類型的可用版本列表
   */
  public async getAvailableVersions(type: ServerType): Promise<AvailableVersion[]> {
    return this.versionManager.getAvailableVersions(type);
  }

  /**
   * 創建新的伺服器
   */
  public async createServer(config: ServerCreationConfig): Promise<void> {
    this.safeConsoleLog(`[ServerManager] 開始創建伺服器: ${config.name} (${config.type} ${config.version})`);
    
    try {
      // 檢查伺服器名稱是否已存在
      const existingServers = await this.scanServers();
      const serverExists = existingServers.some(server => 
        server.name === config.name || server.id === `${config.version}-${config.name}`
      );

      if (serverExists) {
        throw new Error(`伺服器名稱 "${config.name}" 已存在`);
      }

      // 驗證配置
      this.validateServerConfig(config);

      // 使用 ServerCreator 創建伺服器
      await this.serverCreator.createServer(config, this.serverBasePath);
      
      this.safeConsoleLog(`[ServerManager] 伺服器 ${config.name} 創建完成`);
      
    } catch (error) {
      this.safeConsoleError(`[ServerManager] 創建伺服器失敗:`, error);
      throw error;
    }
  }

  /**
   * 驗證伺服器創建配置
   */
  private validateServerConfig(config: ServerCreationConfig): void {
    if (!config.name || config.name.trim().length === 0) {
      throw new Error('伺服器名稱不能為空');
    }

    if (!config.type) {
      throw new Error('必須選擇伺服器類型');
    }

    if (!config.version) {
      throw new Error('必須選擇伺服器版本');
    }

    if (config.port < 1 || config.port > 65535) {
      throw new Error('端口號必須在 1-65535 範圍內');
    }

    // 驗證記憶體設置
    const minMemPattern = /^(\d+)(M|G)$/i;
    const maxMemPattern = /^(\d+)(M|G)$/i;
    
    if (!minMemPattern.test(config.minMemory)) {
      throw new Error('最小記憶體格式錯誤，應該是 "512M" 或 "1G" 的形式');
    }
    
    if (!maxMemPattern.test(config.maxMemory)) {
      throw new Error('最大記憶體格式錯誤，應該是 "1G" 或 "2G" 的形式');
    }

    // 檢查最小記憶體不能大於最大記憶體
    const minMem = this.parseMemorySize(config.minMemory);
    const maxMem = this.parseMemorySize(config.maxMemory);
    
    if (minMem > maxMem) {
      throw new Error('最小記憶體不能大於最大記憶體');
    }

    // 驗證伺服器名稱只能包含安全字符
    const namePattern = /^[a-zA-Z0-9_\-\u4e00-\u9fa5]+$/;
    if (!namePattern.test(config.name)) {
      throw new Error('伺服器名稱只能包含字母、數字、中文、底線和破折號');
    }
  }

  /**
   * 解析記憶體大小字串為MB數值
   */
  private parseMemorySize(memStr: string): number {
    const match = memStr.match(/^(\d+)(M|G)$/i);
    if (!match) return 0;
    
    const value = parseInt(match[1]);
    const unit = match[2].toUpperCase();
    
    return unit === 'G' ? value * 1024 : value;
  }

  /**
   * 檢查伺服器名稱是否可用
   */
  public async isServerNameAvailable(name: string): Promise<boolean> {
    try {
      const servers = await this.scanServers();
      return !servers.some(server => server.name === name);
    } catch (error) {
      this.safeConsoleError('檢查伺服器名稱可用性時發生錯誤:', error);
      return false;
    }
  }

  /**
   * 獲取推薦的伺服器端口
   */
  public async getRecommendedPort(): Promise<number> {
    const defaultPort = 25565;
    
    try {
      const servers = await this.scanServers();
      const usedPorts = new Set<number>();
      
      // 從現有伺服器讀取使用的端口
      for (const server of servers) {
        try {
          const properties = await this.readServerProperties(server.id);
          const port = properties['server-port'];
          if (typeof port === 'number') {
            usedPorts.add(port);
          }
        } catch (error) {
          // 忽略讀取錯誤，繼續檢查下一個
        }
      }

      // 尋找可用端口
      let port = defaultPort;
      while (usedPorts.has(port)) {
        port++;
        if (port > 25600) { // 避免無限循環
          break;
        }
      }
      
      return port;
    } catch (error) {
      this.safeConsoleError('獲取推薦端口時發生錯誤:', error);
      return defaultPort;
    }
  }

  /**
   * 刪除伺服器
   * @param serverId 伺服器 ID
   */
  public async deleteServer(serverId: string): Promise<void> {
    try {
      console.log(`[ServerManager] 開始刪除伺服器: ${serverId}`);
      
      // 獲取伺服器信息
      const servers = await this.scanServers();
      const serverInfo = servers.find(s => s.id === serverId);
      
      if (!serverInfo) {
        throw new Error(`找不到伺服器: ${serverId}`);
      }

      // 檢查伺服器是否正在運行
      const serverInstance = this.getServer(serverId);
      if (serverInstance && serverInstance.getStatus() !== 'stopped') {
        throw new Error('無法刪除正在運行的伺服器，請先停止伺服器');
      }

      // 刪除伺服器目錄
      const fs = await import('fs/promises');
      const { rm } = await import('fs/promises');
      
      try {
        // 使用遞迴刪除目錄
        await rm(serverInfo.path, { recursive: true, force: true });
        console.log(`[ServerManager] 成功刪除伺服器目錄: ${serverInfo.path}`);
      } catch (error) {
        console.error(`[ServerManager] 刪除目錄失敗: ${serverInfo.path}`, error);
        throw new Error(`刪除伺服器目錄失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
      }

      // 從記憶體中移除伺服器實例
      if (serverInstance) {
        this.servers.delete(serverId);
      }

      console.log(`[ServerManager] 伺服器刪除完成: ${serverId}`);
      
    } catch (error) {
      console.error(`[ServerManager] 刪除伺服器失敗: ${serverId}`, error);
      throw error;
    }
  }

  /**
   * 刪除伺服器備份檔案
   * @param serverPath 伺服器路徑
   */
  private async deleteBackupFiles(serverPath: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const backupPath = path.join(serverPath, 'backups');
      
      try {
        await fs.access(backupPath);
        // 備份目錄存在，刪除它
        const { rm } = await import('fs/promises');
        await rm(backupPath, { recursive: true, force: true });
        console.log(`[ServerManager] 成功刪除備份目錄: ${backupPath}`);
      } catch {
        // 備份目錄不存在，忽略
        console.log(`[ServerManager] 備份目錄不存在: ${backupPath}`);
      }
    } catch (error) {
      console.error(`[ServerManager] 刪除備份檔案失敗:`, error);
      // 不拋出錯誤，繼續主刪除操作
    }
  }

  /**
   * 刪除伺服器日誌檔案
   * @param serverPath 伺服器路徑
   */
  private async deleteLogFiles(serverPath: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const logsPath = path.join(serverPath, 'logs');
      
      try {
        await fs.access(logsPath);
        // 日誌目錄存在，刪除它
        const { rm } = await import('fs/promises');
        await rm(logsPath, { recursive: true, force: true });
        console.log(`[ServerManager] 成功刪除日誌目錄: ${logsPath}`);
      } catch {
        // 日誌目錄不存在，忽略
        console.log(`[ServerManager] 日誌目錄不存在: ${logsPath}`);
      }
    } catch (error) {
      console.error(`[ServerManager] 刪除日誌檔案失敗:`, error);
      // 不拋出錯誤，繼續主刪除操作
    }
  }

  // === 地圖管理相關方法 ===

  /**
   * 獲取伺服器中的世界資訊
   */
  public async getWorldInfo(serverId: string): Promise<WorldInfo[]> {
    try {
      const server = await this.loadServer(serverId);
      const serverPath = server.info.path;
      
      this.safeConsoleLog(`[ServerManager] 獲取世界資訊: ${serverId}, 路徑: ${serverPath}`);
      
      // 讀取 server.properties 獲取 level-name
      const properties = await this.readServerProperties(serverId);
      const levelName = properties['level-name'] as string;
      
      if (!levelName) {
        this.safeConsoleLog(`[ServerManager] server.properties 中沒有設定 level-name，跳過世界掃描`);
        return [];
      }
      
      this.safeConsoleLog(`[ServerManager] 檢查世界: ${levelName}`);
      
      const worlds: WorldInfo[] = [];
      const worldPath = join(serverPath, levelName);
      
      try {
        const stats = await stat(worldPath);
        
        if (stats.isDirectory()) {
          // 檢查是否是世界資料夾
          const isWorld = await this.isWorldDirectory(worldPath);
          if (isWorld) {
            const worldInfo = await this.parseWorldDirectory(levelName, worldPath);
            if (worldInfo) {
              worlds.push(worldInfo);
            }
          } else {
            this.safeConsoleLog(`[ServerManager] 目錄 ${levelName} 不是有效的世界資料夾`);
          }
        }
      } catch (error) {
        this.safeConsoleError(`檢查世界目錄 ${levelName} 失敗:`, error);
      }

      this.safeConsoleLog(`[ServerManager] 找到 ${worlds.length} 個世界`);
      return worlds;
    } catch (error) {
      this.safeConsoleError(`獲取世界資訊失敗 (${serverId}):`, error);
      return [];
    }
  }

  /**
   * 檢查目錄是否是世界資料夾
   */
  private async isWorldDirectory(worldPath: string): Promise<boolean> {
    try {
      const files = await readdir(worldPath);
      
      // 檢查是否包含世界檔案
      const hasLevelData = files.includes('level.dat');
      const hasRegionDir = files.includes('region');
      const hasDimension = files.some(file => 
        file === 'DIM-1' || file === 'DIM1' || file.startsWith('dimensions/')
      );
      
      return hasLevelData || hasRegionDir || hasDimension;
    } catch {
      return false;
    }
  }

  /**
   * 解析世界目錄資訊
   */
  private async parseWorldDirectory(dirName: string, worldPath: string): Promise<WorldInfo | null> {
    try {
      const files = await readdir(worldPath);
      const stats = await stat(worldPath);
      
      // 計算資料夾大小
      const size = await this.calculateDirectorySize(worldPath);
      
      // 檢查是否有 level.dat
      const hasLevelData = files.includes('level.dat');
      
      // 判斷世界類型
      let type: WorldInfo['type'] = 'custom';
      if (dirName === 'world' || dirName.includes('world')) {
        type = 'overworld';
      } else if (dirName.includes('nether') || dirName.includes('DIM-1')) {
        type = 'nether';
      } else if (dirName.includes('end') || dirName.includes('DIM1')) {
        type = 'end';
      }

      return {
        name: dirName,
        path: worldPath,
        size,
        type,
        lastModified: stats.mtime,
        hasLevelData
      };
    } catch (error) {
      this.safeConsoleError(`解析世界目錄 ${dirName} 失敗:`, error);
      return null;
    }
  }

  /**
   * 計算目錄大小
   */
  private async calculateDirectorySize(dirPath: string): Promise<number> {
    try {
      let totalSize = 0;
      
      const entries = await readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          totalSize += await this.calculateDirectorySize(fullPath);
        } else if (entry.isFile()) {
          const stats = await stat(fullPath);
          totalSize += stats.size;
        }
      }
      
      return totalSize;
    } catch {
      return 0;
    }
  }

  /**
   * 替換地圖 - 使用選定資料夾的名稱作為新世界名稱
   * @param serverId 伺服器ID
   * @param sourcePath 新地圖的來源路徑
   * @param targetWorldName 要被替換的世界名稱
   */
  public async replaceWorld(serverId: string, sourcePath: string, targetWorldName: string): Promise<string> {
    try {
      const server = await this.loadServer(serverId);
      const serverPath = server.info.path;
      
      // 從來源路徑取得資料夾名稱
      const sourceWorldName = sourcePath.split(/[/\\]/).pop() || 'world';
      
      this.safeConsoleLog(`[ServerManager] 開始替換地圖: ${serverId}`);
      this.safeConsoleLog(`[ServerManager] 來源: ${sourcePath} (${sourceWorldName})`);
      this.safeConsoleLog(`[ServerManager] 替換目標: ${targetWorldName} -> ${sourceWorldName}`);
      
      // 檢查伺服器是否在運行
      if (server.info.status === 'running' || server.info.status === 'starting') {
        throw new Error('伺服器運行中無法替換地圖，請先停止伺服器');
      }

      // 檢查來源路徑是否存在
      try {
        await access(sourcePath);
        const sourceStats = await stat(sourcePath);
        if (!sourceStats.isDirectory()) {
          throw new Error('來源路徑必須是資料夾');
        }
      } catch {
        throw new Error('來源世界資料夾不存在');
      }

      // 檢查來源是否是有效的世界資料夾
      const isValidWorld = await this.isWorldDirectory(sourcePath);
      if (!isValidWorld) {
        throw new Error('來源資料夾不是有效的 Minecraft 世界');
      }

      const targetWorldPath = join(serverPath, targetWorldName);
      const newWorldPath = join(serverPath, sourceWorldName);

      // 檢查新世界名稱是否與現有世界衝突（但排除被替換的目標）
      if (sourceWorldName !== targetWorldName) {
        try {
          await access(newWorldPath);
          throw new Error(`世界名稱 "${sourceWorldName}" 已存在，請選擇其他世界資料夾`);
        } catch (error: any) {
          if (error.code !== 'ENOENT') {
            throw error; // 如果不是"檔案不存在"錯誤，就拋出
          }
          // 如果是"檔案不存在"錯誤，表示新名稱可用，繼續執行
        }
      }

      // 刪除舊世界
      try {
        await access(targetWorldPath);
        this.safeConsoleLog(`[ServerManager] 刪除被替換的世界: ${targetWorldPath}`);
        await rm(targetWorldPath, { recursive: true, force: true });
      } catch {
        // 目標世界不存在，正常情況
        this.safeConsoleLog(`[ServerManager] 被替換的世界不存在: ${targetWorldName}`);
      }

      // 複製新世界到伺服器目錄
      this.safeConsoleLog(`[ServerManager] 複製新世界: ${sourcePath} -> ${newWorldPath}`);
      await this.copyDirectory(sourcePath, newWorldPath);

      // 讀取當前 server.properties
      const properties = await this.readServerProperties(serverId);
      const currentLevelName = properties['level-name'] as string || 'world';

      // 如果被替換的世界是當前的主世界，則更新 level-name 為新的世界名稱
      if (currentLevelName === targetWorldName) {
        await this.updateServerProperties(serverId, {
          'level-name': sourceWorldName
        });
        this.safeConsoleLog(`[ServerManager] 已更新 server.properties 中的 level-name: ${targetWorldName} -> ${sourceWorldName}`);
      }

      this.safeConsoleLog(`[ServerManager] 地圖替換完成: ${targetWorldName} -> ${sourceWorldName}`);
      return sourceWorldName;
    } catch (error) {
      this.safeConsoleError(`替換地圖失敗 (${serverId}):`, error);
      throw error;
    }
  }

  /**
   * 遞迴複製目錄
   */
  private async copyDirectory(source: string, target: string): Promise<void> {
    try {
      // 創建目標目錄
      await mkdir(target, { recursive: true });
      
      const entries = await readdir(source, { withFileTypes: true });
      
      for (const entry of entries) {
        const sourcePath = join(source, entry.name);
        const targetPath = join(target, entry.name);
        
        if (entry.isDirectory()) {
          await this.copyDirectory(sourcePath, targetPath);
        } else if (entry.isFile()) {
          await cp(sourcePath, targetPath);
        }
      }
    } catch (error) {
      this.safeConsoleError(`複製目錄失敗: ${source} -> ${target}`, error);
      throw error;
    }
  }

  /**
   * 刪除世界
   * @param serverId 伺服器ID
   * @param worldName 世界名稱
   */
  public async deleteWorld(serverId: string, worldName: string): Promise<void> {
    try {
      const server = await this.loadServer(serverId);
      const serverPath = server.info.path;
      
      this.safeConsoleLog(`[ServerManager] 刪除世界: ${serverId}, 世界: ${worldName}`);
      
      // 檢查伺服器是否在運行
      if (server.info.status === 'running' || server.info.status === 'starting') {
        throw new Error('伺服器運行中無法刪除世界，請先停止伺服器');
      }

      const worldPath = join(serverPath, worldName);

      // 檢查世界是否存在
      try {
        await access(worldPath);
      } catch {
        throw new Error(`世界 "${worldName}" 不存在`);
      }

      // 刪除世界資料夾
      await rm(worldPath, { recursive: true, force: true });
      
      this.safeConsoleLog(`[ServerManager] 世界刪除完成: ${worldName}`);
    } catch (error) {
      this.safeConsoleError(`刪除世界失敗 (${serverId}, ${worldName}):`, error);
      throw error;
    }
  }

  /**
   * 重新命名世界
   * @param serverId 伺服器ID
   * @param oldWorldName 舊世界名稱
   * @param newWorldName 新世界名稱
   */
  public async renameWorld(serverId: string, oldWorldName: string, newWorldName: string): Promise<void> {
    try {
      const server = await this.loadServer(serverId);
      const serverPath = server.info.path;
      
      this.safeConsoleLog(`[ServerManager] 重新命名世界: ${serverId}, ${oldWorldName} -> ${newWorldName}`);
      
      // 檢查伺服器是否在運行
      if (server.info.status === 'running' || server.info.status === 'starting') {
        throw new Error('伺服器運行中無法重新命名世界，請先停止伺服器');
      }

      // 驗證新世界名稱
      if (!newWorldName || newWorldName.trim().length === 0) {
        throw new Error('世界名稱不能為空');
      }

      // 驗證世界名稱只能包含安全字符
      const namePattern = /^[a-zA-Z0-9_\-\u4e00-\u9fa5]+$/;
      if (!namePattern.test(newWorldName.trim())) {
        throw new Error('世界名稱只能包含字母、數字、中文、底線和破折號');
      }

      const oldWorldPath = join(serverPath, oldWorldName);
      const newWorldPath = join(serverPath, newWorldName.trim());

      // 檢查舊世界是否存在
      try {
        await access(oldWorldPath);
      } catch {
        throw new Error(`世界 "${oldWorldName}" 不存在`);
      }

      // 檢查新世界名稱是否已存在
      try {
        await access(newWorldPath);
        throw new Error(`世界名稱 "${newWorldName}" 已存在`);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          throw error; // 如果不是"檔案不存在"錯誤，就拋出
        }
        // 如果是"檔案不存在"錯誤，表示新名稱可用，繼續執行
      }

      // 重新命名世界資料夾
      await this.copyDirectory(oldWorldPath, newWorldPath);
      await rm(oldWorldPath, { recursive: true, force: true });

      // 讀取當前 server.properties
      const properties = await this.readServerProperties(serverId);
      const currentLevelName = properties['level-name'] as string || 'world';

      // 如果當前的 level-name 指向被重新命名的世界，則更新它
      if (currentLevelName === oldWorldName) {
        await this.updateServerProperties(serverId, {
          'level-name': newWorldName.trim()
        });
        this.safeConsoleLog(`[ServerManager] 已更新 server.properties 中的 level-name: ${oldWorldName} -> ${newWorldName}`);
      }
      
      this.safeConsoleLog(`[ServerManager] 世界重新命名完成: ${oldWorldName} -> ${newWorldName}`);
    } catch (error) {
      this.safeConsoleError(`重新命名世界失敗 (${serverId}, ${oldWorldName} -> ${newWorldName}):`, error);
      throw error;
    }
  }
}