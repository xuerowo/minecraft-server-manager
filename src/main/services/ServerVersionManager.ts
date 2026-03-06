import { EventEmitter } from 'events';
import { ServerType, AvailableVersion, ServerTypeInfo } from '../../shared/types';

interface MojangVersionManifest {
  latest: {
    release: string;
    snapshot: string;
  };
  versions: Array<{
    id: string;
    type: 'release' | 'snapshot';
    url: string;
    time: string;
    releaseTime: string;
  }>;
}

interface PaperVersionResponse {
  project: {
    id: string;
    name: string;
  };
  versions: {
    [key: string]: string[];
  };
}

interface PaperBuildsResponse {
  project_id: string;
  project_name: string;
  version: string;
  builds: Array<{
    build: number;
    time: string;
    channel: string;
    promoted: boolean;
    changes: Array<{
      commit: string;
      summary: string;
      message: string;
    }>;
    downloads: {
      application?: {
        name: string;
        sha256: string;
      };
      'server:default'?: {
        name: string;
        sha256: string;
      };
    };
  }>;
}

export class ServerVersionManager extends EventEmitter {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly cacheExpiry = 15 * 60 * 1000; // 15分鐘快取

  constructor() {
    super();
    // 清除所有快取，確保使用最新代碼
    this.clearCache();
    console.log('[ServerVersionManager] 已創建新實例並清除快取');
  }

  public clearCache(): void {
    console.log('[ServerVersionManager] 清除所有快取');
    this.cache.clear();
  }

  private readonly serverTypes: ServerTypeInfo[] = [
    {
      type: 'vanilla',
      name: 'Vanilla',
      description: '官方原版 Minecraft 伺服器',
      supportsMods: false,
      supportsPlugins: false
    },
    {
      type: 'paper',
      name: 'Paper',
      description: '高性能的 Spigot 分支，支援外掛',
      supportsMods: false,
      supportsPlugins: true
    },
    {
      type: 'spigot',
      name: 'Spigot',
      description: '支援 Bukkit 外掛的伺服器',
      supportsMods: false,
      supportsPlugins: true
    },
    {
      type: 'fabric',
      name: 'Fabric',
      description: '輕量級模組載入器',
      supportsMods: true,
      supportsPlugins: false
    },
    {
      type: 'forge',
      name: 'Forge',
      description: '功能豐富的模組載入器',
      supportsMods: true,
      supportsPlugins: false
    }
  ];

  public getServerTypes(): ServerTypeInfo[] {
    return [...this.serverTypes];
  }

  public async getAvailableVersions(type: ServerType): Promise<AvailableVersion[]> {
    const cacheKey = `versions_${type}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      console.log(`[ServerVersionManager] 使用快取的 ${type} 版本數據`);
      return cached;
    }

    console.log(`[ServerVersionManager] 獲取新的 ${type} 版本數據`);
    try {
      let versions: AvailableVersion[] = [];

      switch (type) {
        case 'vanilla':
          versions = await this.getVanillaVersions();
          break;
        case 'paper':
          versions = await this.getPaperVersions();
          break;
        case 'spigot':
          versions = await this.getSpigotVersions();
          break;
        case 'fabric':
          versions = await this.getFabricVersions();
          break;
        case 'forge':
          versions = await this.getForgeVersions();
          break;
        default:
          throw new Error(`不支援的伺服器類型: ${type}`);
      }

      this.setCache(cacheKey, versions);
      return versions;
    } catch (error) {
      console.error(`獲取 ${type} 版本列表失敗:`, error);
      // 清除錯誤的快取
      this.cache.delete(cacheKey);
      throw error;
    }
  }

  public async getDownloadUrl(type: ServerType, version: string): Promise<string> {
    try {
      switch (type) {
        case 'vanilla':
          return await this.getVanillaDownloadUrl(version);
        case 'paper':
          return await this.getPaperDownloadUrl(version);
        case 'spigot':
          return await this.getSpigotDownloadUrl(version);
        case 'fabric':
          return await this.getFabricDownloadUrl(version);
        case 'forge':
          return await this.getForgeDownloadUrl(version);
        default:
          throw new Error(`不支援的伺服器類型: ${type}`);
      }
    } catch (error) {
      console.error(`獲取 ${type} ${version} 下載連結失敗:`, error);
      throw error;
    }
  }

  private async getVanillaVersions(): Promise<AvailableVersion[]> {
    const response = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest.json', {
      headers: {
        'User-Agent': 'minecraft-server-manager/1.0.0 (https://github.com/yourname/minecraft-server-manager)'
      }
    });

    if (!response.ok) {
      throw new Error(`獲取 Mojang 版本清單失敗: ${response.statusText}`);
    }

    const data = await response.json() as MojangVersionManifest;
    
    return data.versions
      .filter(version => version.type === 'release')
      // 顯示所有 release 版本
      .map(version => ({
        id: version.id,
        type: version.type as 'release' | 'snapshot',
        url: version.url,
        releaseTime: version.releaseTime,
        stable: version.type === 'release'
      }));
  }

  private async getPaperVersions(): Promise<AvailableVersion[]> {
    console.log('[ServerVersionManager] 開始獲取 Paper 版本');
    
    try {
      const response = await fetch('https://fill.papermc.io/v3/projects/paper', {
        headers: {
          'User-Agent': 'minecraft-server-manager/1.0.0 (https://github.com/yourname/minecraft-server-manager)'
        }
      });

      if (!response.ok) {
        throw new Error(`獲取 Paper 版本清單失敗: ${response.statusText}`);
      }

      const data = await response.json() as PaperVersionResponse;
      console.log('[ServerVersionManager] Paper API 回應:', JSON.stringify(data, null, 2));
      console.log('[ServerVersionManager] data.versions 類型:', typeof data.versions);
      console.log('[ServerVersionManager] data.versions 是否為陣列:', Array.isArray(data.versions));
      
      // 檢查版本數據格式
      if (!data.versions || typeof data.versions !== 'object') {
        throw new Error('Paper API 回應格式不正確：缺少 versions 欄位');
      }
      
      // 將版本對象轉換為版本陣列
      const allVersions: string[] = [];
      console.log('[ServerVersionManager] 開始處理版本對象...');
      
      for (const [mcVersion, versions] of Object.entries(data.versions)) {
        console.log(`[ServerVersionManager] 處理版本群組 ${mcVersion}:`, versions);
        if (Array.isArray(versions)) {
          allVersions.push(...versions);
        } else {
          console.warn(`[ServerVersionManager] 跳過非陣列版本群組: ${mcVersion}`, versions);
        }
      }
      
      console.log('[ServerVersionManager] 所有版本:', allVersions);
      
      // 按版本號排序（新版本在前）
      const sortedVersions = allVersions
        .filter(version => /^\d+\.\d+(\.\d+)?$/.test(version)) // 只保留正式版本格式
        .sort((a, b) => {
          const aparts = a.split('.').map(Number);
          const bparts = b.split('.').map(Number);
          
          // 比較主版本
          if (aparts[0] !== bparts[0]) return bparts[0] - aparts[0];
          // 比較次版本
          if (aparts[1] !== bparts[1]) return bparts[1] - aparts[1];
          // 比較修訂版本
          return (bparts[2] || 0) - (aparts[2] || 0);
        })
        // 顯示所有版本
      
      console.log('[ServerVersionManager] 排序後版本:', sortedVersions);
      
      const result = sortedVersions.map(version => ({
        id: version,
        type: 'release' as const,
        releaseTime: new Date().toISOString(),
        stable: true
      }));
      
      console.log('[ServerVersionManager] 最終結果:', result);
      return result;
      
    } catch (error) {
      console.error('[ServerVersionManager] getPaperVersions 發生錯誤:', error);
      throw error;
    }
  }

  private async getSpigotVersions(): Promise<AvailableVersion[]> {
    // Spigot 沒有官方 API，使用常見版本列表（擴展到更多版本）
    const commonVersions = [
      // 1.21.x
      '1.21.8', '1.21.7', '1.21.6', '1.21.5', '1.21.4', '1.21.3', '1.21.2', '1.21.1', '1.21',
      // 1.20.x
      '1.20.6', '1.20.5', '1.20.4', '1.20.3', '1.20.2', '1.20.1', '1.20',
      // 1.19.x
      '1.19.4', '1.19.3', '1.19.2', '1.19.1', '1.19',
      // 1.18.x
      '1.18.2', '1.18.1', '1.18',
      // 1.17.x
      '1.17.1', '1.17',
      // 1.16.x
      '1.16.5', '1.16.4', '1.16.3', '1.16.2', '1.16.1', '1.16',
      // 1.15.x
      '1.15.2', '1.15.1', '1.15',
      // 1.14.x
      '1.14.4', '1.14.3', '1.14.2', '1.14.1', '1.14',
      // 1.13.x
      '1.13.2', '1.13.1', '1.13',
      // 1.12.x
      '1.12.2', '1.12.1', '1.12',
      // 1.11.x
      '1.11.2', '1.11.1', '1.11',
      // 1.10.x
      '1.10.2', '1.10.1', '1.10',
      // 1.9.x
      '1.9.4', '1.9.3', '1.9.2', '1.9.1', '1.9',
      // 1.8.x
      '1.8.9', '1.8.8', '1.8.7', '1.8.6', '1.8.5', '1.8.4', '1.8.3', '1.8.2', '1.8.1', '1.8',
      // 1.7.x
      '1.7.10', '1.7.9', '1.7.8', '1.7.7', '1.7.6', '1.7.5', '1.7.4', '1.7.2',
      // 1.6.x
      '1.6.4', '1.6.2', '1.6.1',
      // 1.5.x
      '1.5.2', '1.5.1',
      // 1.4.x
      '1.4.7', '1.4.6', '1.4.5', '1.4.4', '1.4.2',
      // 1.3.x
      '1.3.2', '1.3.1',
      // 1.2.x
      '1.2.5', '1.2.4', '1.2.3', '1.2.2', '1.2.1',
      // 1.1.x
      '1.1',
      // 1.0.x
      '1.0.1', '1.0.0'
    ];

    return commonVersions.map(version => ({
      id: version,
      type: 'release' as const,
      releaseTime: new Date().toISOString(),
      stable: true
    }));
  }

  private async getFabricVersions(): Promise<AvailableVersion[]> {
    // 獲取 Fabric Loader 支援的 Minecraft 版本
    const response = await fetch('https://meta.fabricmc.net/v2/versions/game', {
      headers: {
        'User-Agent': 'minecraft-server-manager/1.0.0 (https://github.com/yourname/minecraft-server-manager)'
      }
    });

    if (!response.ok) {
      throw new Error(`獲取 Fabric 版本清單失敗: ${response.statusText}`);
    }

    const data = await response.json() as any[];
    
    return data
      .filter((version: any) => version.stable)
      // 顯示所有穩定版本
      .map((version: any) => ({
        id: version.version,
        type: 'release' as const,
        releaseTime: version.releaseTime || new Date().toISOString(),
        stable: version.stable
      }));
  }

  private async getForgeVersions(): Promise<AvailableVersion[]> {
    // Forge API 較複雜，使用常見版本列表（擴展到更多版本）
    const commonVersions = [
      // 1.21.x
      '1.21.8', '1.21.7', '1.21.6', '1.21.5', '1.21.4', '1.21.3', '1.21.2', '1.21.1', '1.21',
      // 1.20.x
      '1.20.6', '1.20.5', '1.20.4', '1.20.3', '1.20.2', '1.20.1', '1.20',
      // 1.19.x
      '1.19.4', '1.19.3', '1.19.2', '1.19.1', '1.19',
      // 1.18.x
      '1.18.2', '1.18.1', '1.18',
      // 1.17.x
      '1.17.1', '1.17',
      // 1.16.x
      '1.16.5', '1.16.4', '1.16.3', '1.16.2', '1.16.1', '1.16',
      // 1.15.x
      '1.15.2', '1.15.1', '1.15',
      // 1.14.x
      '1.14.4', '1.14.3', '1.14.2', '1.14.1', '1.14',
      // 1.13.x
      '1.13.2', '1.13.1', '1.13',
      // 1.12.x
      '1.12.2', '1.12.1', '1.12',
      // 1.11.x
      '1.11.2', '1.11.1', '1.11',
      // 1.10.x
      '1.10.2', '1.10.1', '1.10',
      // 1.9.x
      '1.9.4', '1.9.3', '1.9.2', '1.9.1', '1.9',
      // 1.8.x
      '1.8.9', '1.8.8', '1.8.7', '1.8.6', '1.8.5', '1.8.4', '1.8.3', '1.8.2', '1.8.1', '1.8',
      // 1.7.x
      '1.7.10', '1.7.9', '1.7.8', '1.7.7', '1.7.6', '1.7.5', '1.7.4', '1.7.2',
      // 1.6.x
      '1.6.4', '1.6.2', '1.6.1',
      // 1.5.x
      '1.5.2', '1.5.1',
      // 1.4.x
      '1.4.7', '1.4.6', '1.4.5', '1.4.4', '1.4.2',
      // 1.3.x
      '1.3.2', '1.3.1',
      // 1.2.x
      '1.2.5', '1.2.4', '1.2.3', '1.2.2', '1.2.1',
      // 1.1.x
      '1.1',
      // 1.0.x
      '1.0.1', '1.0.0'
    ];

    return commonVersions.map(version => ({
      id: version,
      type: 'release' as const,
      releaseTime: new Date().toISOString(),
      stable: true
    }));
  }

  private async getVanillaDownloadUrl(version: string): Promise<string> {
    const manifest = await this.getVanillaVersionManifest(version);
    return manifest.downloads?.server?.url || '';
  }

  private async getPaperDownloadUrl(version: string): Promise<string> {
    const buildsResponse = await fetch(`https://fill.papermc.io/v3/projects/paper/versions/${version}/builds`, {
      headers: {
        'User-Agent': 'minecraft-server-manager/1.0.0 (https://github.com/yourname/minecraft-server-manager)'
      }
    });

    if (!buildsResponse.ok) {
      throw new Error(`獲取 Paper ${version} 構建列表失敗: ${buildsResponse.statusText}`);
    }

    const builds = await buildsResponse.json() as PaperBuildsResponse;
    const stableBuild = builds.builds.find(build => build.channel === 'STABLE') || builds.builds[0];

    if (!stableBuild || !stableBuild.downloads['server:default']) {
      throw new Error(`找不到 Paper ${version} 的下載檔案`);
    }

    return `https://fill.papermc.io/v3/projects/paper/versions/${version}/builds/${stableBuild.build}/downloads/${stableBuild.downloads['server:default'].name}`;
  }

  private async getSpigotDownloadUrl(version: string): Promise<string> {
    // Spigot 需要使用 BuildTools，這裡返回 BuildTools 下載連結
    return 'https://hub.spigotmc.org/jenkins/job/BuildTools/lastSuccessfulBuild/artifact/target/BuildTools.jar';
  }

  private async getFabricDownloadUrl(version: string): Promise<string> {
    // 獲取最新的 Fabric Loader 版本
    const loaderResponse = await fetch('https://meta.fabricmc.net/v2/versions/loader', {
      headers: {
        'User-Agent': 'minecraft-server-manager/1.0.0 (https://github.com/yourname/minecraft-server-manager)'
      }
    });

    if (!loaderResponse.ok) {
      throw new Error(`獲取 Fabric Loader 版本失敗: ${loaderResponse.statusText}`);
    }

    const loaders = await loaderResponse.json() as any[];
    const latestLoader = loaders[0];

    // 獲取最新的 Installer 版本
    const installerResponse = await fetch('https://meta.fabricmc.net/v2/versions/installer', {
      headers: {
        'User-Agent': 'minecraft-server-manager/1.0.0 (https://github.com/yourname/minecraft-server-manager)'
      }
    });

    if (!installerResponse.ok) {
      throw new Error(`獲取 Fabric Installer 版本失敗: ${installerResponse.statusText}`);
    }

    const installers = await installerResponse.json() as any[];
    const latestInstaller = installers[0];

    return `https://meta.fabricmc.net/v2/versions/loader/${version}/${latestLoader.version}/${latestInstaller.version}/server/jar`;
  }

  private async getForgeDownloadUrl(version: string): Promise<string> {
    // Forge 下載較複雜，這裡先返回 Forge MDK 或 Installer 的基本 URL 格式
    // 實際實作時需要查詢 Forge 的 API 獲取確切版本
    return `https://maven.minecraftforge.net/net/minecraftforge/forge/${version}-latest/forge-${version}-latest-installer.jar`;
  }

  private async getVanillaVersionManifest(version: string): Promise<any> {
    const manifestResponse = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest.json', {
      headers: {
        'User-Agent': 'minecraft-server-manager/1.0.0 (https://github.com/yourname/minecraft-server-manager)'
      }
    });

    if (!manifestResponse.ok) {
      throw new Error(`獲取版本清單失敗: ${manifestResponse.statusText}`);
    }

    const manifest = await manifestResponse.json() as MojangVersionManifest;
    const versionInfo = manifest.versions.find(v => v.id === version);

    if (!versionInfo) {
      throw new Error(`找不到版本 ${version}`);
    }

    const versionResponse = await fetch(versionInfo.url, {
      headers: {
        'User-Agent': 'minecraft-server-manager/1.0.0 (https://github.com/yourname/minecraft-server-manager)'
      }
    });

    if (!versionResponse.ok) {
      throw new Error(`獲取版本資訊失敗: ${versionResponse.statusText}`);
    }

    return await versionResponse.json() as any;
  }

  private getCached(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }
}