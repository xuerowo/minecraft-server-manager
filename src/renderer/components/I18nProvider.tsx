import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ConfigProvider } from 'antd';
import zhTW from 'antd/locale/zh_TW';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import { i18n, type LanguageCode } from '../../shared/i18n';

interface I18nContextType {
  currentLanguage: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  t: (key: string, params?: Record<string, any>, defaultValue?: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

interface I18nProviderProps {
  children: ReactNode;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>(i18n.getLanguage());

  useEffect(() => {
    const handleLanguageChange = (event: CustomEvent) => {
      setCurrentLanguage(event.detail.language);
    };

    // 監聽語言變化事件
    const listener = (event: Event) => {
      handleLanguageChange(event as CustomEvent);
    };
    
    window.addEventListener('languageChanged', listener);

    // 初始化時設置視窗標題
    const initializeWindowTitle = async () => {
      try {
        const windowTitle = i18n.t('app.windowTitle', {}, 'Minecraft Server Manager');
        await window.electronAPI.setWindowTitle(windowTitle);
      } catch (error) {
        console.warn('Failed to set initial window title:', error);
      }
    };
    
    initializeWindowTitle();

    return () => {
      window.removeEventListener('languageChanged', listener);
    };
  }, []);

  const setLanguage = async (language: LanguageCode) => {
    i18n.setLanguage(language);
    setCurrentLanguage(language);
    
    // 保存語言設置到應用程式設定
    try {
      const currentSettings = await window.electronAPI.loadSettings();
      await window.electronAPI.saveSettings({
        ...currentSettings,
        language
      });
    } catch (error) {
      console.warn('Failed to save language setting:', error);
    }
    
    // 更新視窗標題
    try {
      const windowTitle = i18n.t('app.windowTitle', {}, 'Minecraft Server Manager');
      await window.electronAPI.setWindowTitle(windowTitle);
    } catch (error) {
      console.warn('Failed to update window title:', error);
    }
    
    // 通知其他元件語言已變更
    window.dispatchEvent(new CustomEvent('languageChanged', { 
      detail: { language } 
    }));
  };

  const t = (key: string, params?: Record<string, any>, defaultValue?: string) => {
    return i18n.t(key, params, defaultValue);
  };

  const getAntdLocale = () => {
    switch (currentLanguage) {
      case 'zh-CN':
        return zhCN;
      case 'en-US':
        return enUS;
      default:
        return zhTW;
    }
  };

  return (
    <I18nContext.Provider value={{ currentLanguage, setLanguage, t }}>
      <ConfigProvider locale={getAntdLocale()}>
        {children}
      </ConfigProvider>
    </I18nContext.Provider>
  );
};

export const useI18nContext = () => {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18nContext must be used within an I18nProvider');
  }
  return context;
};