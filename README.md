# Minecraft 伺服器管理工具

一個基於 Electron + React + TypeScript 構建的現代化 Minecraft 伺服器管理應用程式。

## 功能特色

### 🎮 伺服器管理
- 伺服器自動掃描與識別
- 一鍵啟動/停止伺服器
- 即時伺服器狀態監控
- 支援多個伺服器版本管理

### 💻 控制台功能
- 即時日誌串流顯示
- 指令輸入與執行
- 日誌過濾與搜索
- 日誌匯出功能

### ⚙️ 伺服器設置
- server.properties 視覺化編輯
- 配置項目分類展示
- 即時儲存與驗證

### 🗺️ 地圖管理
- 世界檔案管理
- 自動備份機制
- 備份還原功能

### 👥 玩家管理
- OP 權限管理
- 封禁/白名單管理
- 玩家統計資訊

### 🎨 現代化介面
- 深色主題設計
- 響應式布局
- 直觀的操作體驗
- Minecraft 風格設計元素

## 技術架構

- **前端框架**: Electron + React 18 + TypeScript
- **UI 組件**: Ant Design
- **狀態管理**: Zustand
- **樣式設計**: Tailwind CSS
- **構建工具**: Vite
- **程式碼品質**: ESLint + Prettier

## 開發環境要求

- Node.js >= 18.0.0
- npm >= 8.0.0
- Java (用於運行 Minecraft 伺服器)

## 安裝與使用

### 1. 安裝依賴

\`\`\`bash
npm install
\`\`\`

### 2. 開發模式

\`\`\`bash
# 啟動渲染程序開發伺服器
npm run dev

# 在另一個終端啟動 Electron (等待上述指令完成後)
npm run electron:dev
\`\`\`

### 3. 建構應用程式

\`\`\`bash
# 建構所有程序
npm run build

# 打包成可執行檔
npm run electron:dist
\`\`\`

### 4. 程式碼檢查與格式化

\`\`\`bash
# 執行 ESLint 檢查
npm run lint

# 自動修復可修復的問題
npm run lint:fix

# 格式化程式碼
npm run format
\`\`\`

## 目錄結構

\`\`\`
minecraft-server-manager/
├── src/
│   ├── main/                    # Electron 主程序
│   │   ├── services/           # 後端服務
│   │   ├── ipc/               # IPC 通訊處理
│   │   └── utils/             # 工具函數
│   ├── renderer/              # React 渲染程序
│   │   ├── components/        # 共用組件
│   │   ├── pages/            # 頁面組件
│   │   ├── store/            # 狀態管理
│   │   └── styles/           # 樣式檔案
│   ├── preload/              # Preload 腳本
│   └── shared/               # 共用類型與常數
├── assets/                   # 靜態資源
└── build/                   # 構建腳本
\`\`\`

## 使用說明

### 首次使用

1. 確保您的 Minecraft 伺服器位於 \`servers\` 目錄中
2. 每個伺服器應該有自己的子目錄
3. 目錄命名格式建議: \`版本號-伺服器名稱\` (例如: \`1.21.8-原味生存\`)
4. 每個伺服器目錄應包含 \`server.jar\` 檔案

### 伺服器管理

- 在主頁面可以看到所有可用的伺服器
- 點擊伺服器卡片可以查看詳細資訊
- 使用 "啟動伺服器" 按鈕來啟動伺服器
- 使用 "控制台" 按鈕來查看日誌和發送指令

### 控制台使用

- 伺服器啟動後，可以在控制台頁面查看即時日誌
- 在底部輸入框中輸入指令並按 Enter 發送
- 使用 "清除" 按鈕清空日誌顯示
- 使用 "匯出" 按鈕將日誌儲存為文字檔案

## 開發指南

### 添加新功能

1. 在 \`src/main/services\` 中添加後端服務邏輯
2. 在 \`src/main/ipc\` 中添加 IPC 處理器
3. 在 \`src/preload\` 中暴露 API 給渲染程序
4. 在 \`src/renderer\` 中實作前端 UI

### 狀態管理

本專案使用 Zustand 進行狀態管理，主要的狀態儲存在:
- \`serverStore\`: 伺服器相關狀態
- 需要時可添加更多 store

### 樣式設計

- 使用 Tailwind CSS 進行快速樣式開發
- 自定義樣式放在 \`src/renderer/styles\` 目錄
- 遵循 Minecraft 主題的配色方案

## 常見問題

### Q: 伺服器無法啟動
A: 請檢查:
1. Java 是否已正確安裝
2. 伺服器目錄是否包含有效的 server.jar 檔案
3. 伺服器目錄權限是否正確

### Q: 無法看到伺服器列表
A: 請確保:
1. servers 目錄存在且包含有效的伺服器
2. 每個伺服器目錄都有 jar 檔案
3. 檢查應用程式設定中的伺服器根目錄路徑

## 授權

MIT License - 詳見 LICENSE 檔案

## 貢獻

歡迎提交 Issue 和 Pull Request 來幫助改善這個專案！
\`\`\`