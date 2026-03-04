# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 開發指令

### 開發模式
```bash
# 啟動開發環境（需要在兩個終端分別執行）
npm run dev                    # 啟動 Vite 開發伺服器
npm run electron:dev           # 啟動 Electron 應用程式 (需等待上一個指令完成)
```

### 建構
```bash
npm run build                  # 建構所有部分（main、preload、renderer）
npm run build:main            # 僅建構主程序
npm run build:preload         # 僅建構 preload 腳本
npm run build:renderer        # 僅建構渲染程序
npm run electron:dist          # 建構並打包成可執行檔
```

### 程式碼品質
```bash
npm run lint                   # 執行 ESLint 檢查
npm run lint:fix              # 自動修復 ESLint 問題
npm run format                # 使用 Prettier 格式化程式碼
```

## 技術架構

這是一個基於 **Electron + React + TypeScript** 的桌面應用程式，採用多程序架構：

### 主程序架構 (Main Process)
- **`src/main/main.ts`** - 應用程式入口點，管理視窗生命週期
- **`src/main/services/ServerManager.ts`** - 核心服務類別，處理所有 Minecraft 伺服器操作
- **`src/main/ipc/setupIPC.ts`** - IPC 通訊設置，連接主程序與渲染程序
- **`src/main/utils/platform.ts`** - 跨平台工具函數

### 渲染程序架構 (Renderer Process)
- **狀態管理**: 使用 Zustand (`src/renderer/store/serverStore.ts`)
- **路由**: React Router DOM，支援以下頁面路徑：
  - `/` - 伺服器儀表板
  - `/console/:serverId` - 伺服器控制台
  - `/settings/:serverId` - 伺服器設置
  - `/maps/:serverId` - 地圖管理
  - `/players/:serverId` - 玩家管理
  - `/app-settings` - 應用程式設置
- **UI 組件**: Ant Design + Tailwind CSS

### 關鍵服務類別
**`ServerManager`** 是應用程式的核心，提供：
- 伺服器掃描與管理 (`scanServers()`, `loadServer()`)
- 伺服器生命週期控制（啟動、停止、重啟）
- 伺服器配置管理 (`readServerProperties()`, `writeServerProperties()`)
- 玩家管理（讀取/寫入 ops.json, whitelist.json 等）
- 日誌處理與即時串流

### 資料結構
主要介面定義於 `src/shared/types/index.ts`：
- `ServerInfo` - 伺服器基本資訊
- `ServerProperties` - server.properties 配置
- `PlayerInfo` - 玩家資訊
- `LogEntry` - 日誌條目

## 開發注意事項

### 路徑別名
配置在 `tsconfig.json` 中：
```typescript
"@/*": ["src/*"]           // 根目錄別名
"@shared/*": ["src/shared/*"]  // 共享類型別名  
"@renderer/*": ["src/renderer/*"]  // 渲染程序別名
"@main/*": ["src/main/*"]  // 主程序別名
```

### 伺服器目錄結構
應用程式預期的伺服器目錄結構：
```
servers/
├── 1.21.8-原味生存/        # 目錄名格式: 版本號-伺服器名稱
│   ├── server.jar          # 必須包含 server.jar 或包含 "server" 的 jar 檔案
│   ├── server.properties   # 伺服器配置
│   ├── usercache.json      # 玩家快取
│   ├── ops.json           # OP 列表
│   └── whitelist.json     # 白名單
```

### IPC 通訊模式
主程序與渲染程序透過 IPC 通訊：
- 所有伺服器操作都通過 `window.electronAPI` 暴露給渲染程序
- 事件監聽器設置於 `src/renderer/App.tsx`
- ServerManager 的事件透過 IPC 轉發到前端

### 狀態管理模式
使用 Zustand 進行狀態管理，主要狀態包括：
- `servers` - 伺服器列表
- `logs` - 各伺服器的日誌記錄
- `currentServerId` - 目前選中的伺服器
- `selectedServers` - 多選的伺服器列表

### 錯誤處理策略
- ServerManager 使用安全的中文字元處理（`safeConsoleLog`, `safeConsoleError`）
- 損壞的 JSON 檔案會自動備份到 `backups/` 目錄
- 各種檔案讀取操作都有獨立的錯誤處理，失敗時返回空陣列而非拋出異常

### 建構配置
多個 Vite 配置檔案分別處理不同部分：
- `vite.main.config.ts` - 主程序建構
- `vite.preload.config.ts` - Preload 腳本建構  
- `vite.renderer.config.ts` - 渲染程序建構
- `vite.config.ts` - 開發環境配置