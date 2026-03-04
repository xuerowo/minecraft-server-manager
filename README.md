# Minecraft 伺服器管理工具 (Minecraft Server Manager)

一個基於 Electron 的 Minecraft 伺服器管理工具，提供直觀的圖形介面來管理您的 Minecraft 伺服器。包含伺服器控制台、設定編輯、地圖管理、玩家管理等豐富功能。

![專案截圖](assets/screenshot.png) *(如有截圖請替換此處)*

## 🚀 主要功能

- **伺服器儀表板**：一目了然地查看所有伺服器的運行狀態、版本、端口及線上人數。
- **即時控制台**：即時查看伺服器日誌並發送指令，支援指令自動完成功能。
- **伺服器創建器**：輕鬆創建不同類型（如 Vanilla, Spigot, Paper 等）和版本的 Minecraft 伺服器。
- **配置編輯器**：視覺化編輯 `server.properties`，無需手動修改文字檔。
- **地圖管理**：支援地圖備份、還原、重命名及替換世界地圖，自動處理 level.dat 檔案。
- **玩家管理**：輕鬆管理 OP 權限、白名單及封禁列表。
- **多語言支援**：提供繁體中文、簡體中文及英文介面。

## 🛠️ 技術堆疊

- **核心框架**：[Electron](https://www.electronjs.org/)
- **前端框架**：[React](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/)
- **建構工具**：[Vite](https://vitejs.dev/)
- **UI 組件庫**：[Ant Design (antd)](https://ant.design/)
- **樣式管理**：[TailwindCSS](https://tailwindcss.com/)
- **狀態管理**：[Zustand](https://github.com/pmndrs/zustand)
- **路由管理**：[React Router](https://reactrouter.com/)

## 📦 安裝與開發

### 前置需求

- [Node.js](https://nodejs.org/) (建議 v18 以上)
- npm 或 yarn

### 開發模式

1. 安裝依賴：
   ```bash
   npm install
   ```

2. 啟動開發伺服器：
   ```bash
   npm run electron:dev
   ```

### 構建發行版

構建適用於當前作業系統的安裝包：
```bash
npm run electron:dist
```

## 📂 專案結構

- `src/main`: Electron 主進程代碼（系統操作、文件管理、伺服器進程控制）。
- `src/renderer`: React 渲染進程代碼（UI 介面、狀態管理）。
- `src/preload`: 預載腳本，作為主進程與渲染進程的橋樑。
- `src/shared`: 共享的類型定義、國際化配置（i18n）及常量。

## 📄 授權條款

本專案採用 [MIT License](LICENSE) 授權。
