# Scripts & Utilities

此目錄包含專案開發過程中使用的各種測試與除錯指令碼。

## 指令碼清單

- `debug-*`: 用於測試多國語言 (i18n) 與合併功能的除錯指令碼。
- `test-*`: 針對各項功能 (preload, window title, translation) 的測試案例。
- `test-*.html`: 用於預覽組件或設置頁面的靜態頁面。
- `all_keys.txt` / `current_keys.txt`: 語言金鑰清單。

## 如何使用

這些指令碼可以直接使用 `node` 或在瀏覽器中開啟 HTML 檔案進行測試。
例如：
```bash
node scripts/debug-i18n.js
```
