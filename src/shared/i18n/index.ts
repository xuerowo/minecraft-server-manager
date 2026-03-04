import zhTW from './locales/zh-TW.json';
import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';
import serverPropertiesTW from './locales/serverProperties.json';
import serverPropertiesCN from './locales/serverProperties-zh-CN.json';
import serverPropertiesEN from './locales/serverProperties-en.json';

export type LanguageCode = 'zh-TW' | 'zh-CN' | 'en-US';

export interface TranslationResources {
  [key: string]: string | TranslationResources;
}

export interface I18nConfig {
  defaultLanguage: LanguageCode;
  supportedLanguages: LanguageCode[];
  resources: Record<LanguageCode, TranslationResources>;
}

export const i18nConfig: I18nConfig = {
  defaultLanguage: 'zh-TW',
  supportedLanguages: ['zh-TW', 'zh-CN', 'en-US'],
  resources: {
    'zh-TW': { ...zhTW, ...serverPropertiesTW },
    'zh-CN': { ...zhCN, ...serverPropertiesCN },
    'en-US': { ...enUS, ...serverPropertiesEN }
  }
};

export class I18nManager {
  private currentLanguage: LanguageCode;
  private resources: Record<LanguageCode, TranslationResources>;

  constructor(config: I18nConfig) {
    this.currentLanguage = config.defaultLanguage;
    this.resources = config.resources;
  }

  setLanguage(language: LanguageCode): void {
    if (this.resources[language]) {
      this.currentLanguage = language;
    } else {
      console.warn(`Language ${language} is not supported, falling back to default`);
      this.currentLanguage = i18nConfig.defaultLanguage;
    }
  }

  getLanguage(): LanguageCode {
    return this.currentLanguage;
  }

  t(key: string, params?: Record<string, any>, defaultValue?: string): string {
    // Special handling for server properties with dots in keys
    if (key.startsWith('serverProperties.properties.')) {
      const remainingKey = key.substring('serverProperties.properties.'.length);
      
      // Check if this is a server property key that contains dots
      const serverProps = this.resources[this.currentLanguage]?.serverProperties?.properties;
      if (serverProps) {
        // Look for exact match first (for keys with dots like 'query.port')
        for (const propKey of Object.keys(serverProps)) {
          if (remainingKey.startsWith(propKey + '.')) {
            const subKey = remainingKey.substring(propKey.length + 1); // +1 for the dot
            const propValue = serverProps[propKey];
            
            if (propValue && typeof propValue === 'object' && subKey in propValue) {
              let result = propValue[subKey];
              
              // Replace parameters
              if (params && typeof result === 'string') {
                Object.entries(params).forEach(([paramKey, paramValue]) => {
                  result = result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
                });
              }
              
              return typeof result === 'string' ? result : (defaultValue || key);
            }
          }
        }
      }
    }
    
    // Default handling for regular keys
    const keys = key.split('.');
    let value: any = this.resources[this.currentLanguage];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue || key;
      }
    }

    let result = typeof value === 'string' ? value : (defaultValue || key);
    
    // 替換參數
    if (params) {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        result = result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
      });
    }
    
    return result;
  }

  getSupportedLanguages(): LanguageCode[] {
    return i18nConfig.supportedLanguages;
  }

  getLanguageName(languageCode: LanguageCode): string {
    const names: Record<LanguageCode, string> = {
      'zh-TW': '繁體中文',
      'zh-CN': '简体中文',
      'en-US': 'English'
    };
    return names[languageCode] || languageCode;
  }
}

export const i18n = new I18nManager(i18nConfig);

export default i18n;