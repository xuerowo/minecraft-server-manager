import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import zhTW from 'antd/locale/zh_TW';
import { App } from './App';
import './styles/index.css';

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhTW}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#00aa00',
          colorBgBase: '#1a1a1a',
          colorTextBase: '#ffffff',
          colorBorder: '#333333',
          borderRadius: 6,
        },
        components: {
          Layout: {
            bodyBg: '#1a1a1a',
            headerBg: '#262626',
            siderBg: '#1f1f1f',
          },
          Menu: {
            darkItemBg: '#1f1f1f',
            darkSubMenuItemBg: '#1f1f1f',
            darkItemSelectedBg: '#00aa00',
            darkItemHoverBg: '#333333',
          }
        }
      }}
    >
      <Router>
        <App />
      </Router>
    </ConfigProvider>
  </React.StrictMode>
);