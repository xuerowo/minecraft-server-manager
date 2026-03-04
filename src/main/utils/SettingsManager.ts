import * as fs from 'fs/promises';
import * as path from 'path';
import { type LanguageCode } from '../../shared/i18n';

interface AppSettings {
  language: LanguageCode;
  customServerPath: string;
}

export class SettingsManager {
  private settingsPath: string;
  private defaultSettings: AppSettings = {
    language: 'zh-TW',
    customServerPath: ''
  };

  constructor() {
    const userDataPath = process.env.APPDATA || 
      (process.platform === 'darwin' 
        ? path.join(process.env.HOME!, 'Library', 'Application Support') 
        : path.join(process.env.HOME!, '.config'));
    
    this.settingsPath = path.join(userDataPath, 'minecraft-server-manager', 'settings.json');
  }

  async loadSettings(): Promise<AppSettings> {
    try {
      await fs.mkdir(path.dirname(this.settingsPath), { recursive: true });
      const settingsData = await fs.readFile(this.settingsPath, 'utf-8');
      const settings = JSON.parse(settingsData);
      
      console.log('設定檔案載入成功:', this.settingsPath);
      // 合併預設設定和載入的設定，確保所有欄位都存在
      return { ...this.defaultSettings, ...settings };
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        // 設定檔案不存在，返回預設設定
        console.log('設定檔案不存在，使用預設設定:', this.settingsPath);
        return { ...this.defaultSettings };
      }
      console.error('載入設定失敗:', error);
      return { ...this.defaultSettings };
    }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.settingsPath), { recursive: true });
      const settingsData = JSON.stringify(settings, null, 2);
      await fs.writeFile(this.settingsPath, settingsData, 'utf-8');
      console.log('設定檔案儲存成功:', this.settingsPath);
    } catch (error) {
      console.error('儲存設定失敗:', error);
      throw error;
    }
  }

  async resetSettings(): Promise<void> {
    try {
      await this.saveSettings(this.defaultSettings);
    } catch (error) {
      console.error('重置設定失敗:', error);
      throw error;
    }
  }

  getDefaultSettings(): AppSettings {
    return { ...this.defaultSettings };
  }
}