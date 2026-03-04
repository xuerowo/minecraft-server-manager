# Minecraft 伺服器管理工具 (Minecraft Server Manager)

一個基於 Electron 的 Minecraft 伺服器管理工具，提供直觀的圖形介面來管理您的 Minecraft 伺服器。包含伺服器控制台、設定編輯、地圖管理、玩家管理等豐富功能。

## 🚀 主要功能

- **伺服器儀表板**：一目了然地查看所有伺服器的運行狀態、版本、端口及線上人數。
- **即時控制台**：即時查看伺服器日誌並發送指令，支援指令自動完成功能。
- **伺服器創建器**：輕鬆創建不同類型（如 Vanilla, Spigot, Paper 等）和版本的 Minecraft 伺服器。
- **配置編輯器**：視覺化編輯 `server.properties`，無需手動修改文字檔。
- **地圖管理**：支援地圖備份、還原、重命名及替換世界地圖，自動處理 level.dat 檔案。
- **玩家管理**：輕鬆管理 OP 權限、白名單及封禁列表。
- **多語言支援**：提供繁體中文、簡體中文及英文介面。

## 💻 如何開啟應用程式

### Windows 用戶 (快速啟動)
如果您已經安裝了 [Node.js](https://nodejs.org/)，請依序執行以下檔案：
1. **`start-dev.bat`**：啟動開發伺服器（請保持視窗開啟）。
2. **`run-electron.bat`**：開啟應用程式主視窗。

### 開發者啟動方式
1. **安裝依賴** (僅第一次需要)：
   ```bash
   npm install
   ```

2. **啟動開發模式**：
   ```bash
   npm run dev
   ```
   *這將啟動 Vite 開發伺服器。*

3. **啟動 Electron**：
   在新終端機執行：
   ```bash
   npm run electron:dev
   ```

## 🛠️ 技術堆疊

- **核心框架**：[Electron](https://www.electronjs.org/)
- **前端框架**：[React](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/)
- **建構工具**：[Vite](https://vitejs.dev/)
- **UI 組件庫**：[Ant Design (antd)](https://ant.design/)
- **樣式管理**：[TailwindCSS](https://tailwindcss.com/)
- **狀態管理**：[Zustand](https://github.com/pmndrs/zustand)

## 📦 構建發行版 (打包成 .exe)

如果您想將程式打包成獨立的安裝檔，請執行：
```bash
npm run electron:dist
```
構建完成後的安裝檔將會存放在 `release/` 目錄中。

## 📂 專案結構

- `src/main`: Electron 主進程代碼（系統操作、文件管理、伺服器進程控制）。
- `src/renderer`: React 渲染進程代碼（UI 介面、狀態管理）。
- `src/preload`: 預載腳本，作為主進程與渲染進程的橋樑。
- `src/shared`: 共享的類型定義、國際化配置（i18n）及常量。
