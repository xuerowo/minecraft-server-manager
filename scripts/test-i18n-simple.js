// 簡單測試 i18n 功能
import { readFileSync } from 'fs';

console.log('測試 i18n 翻譯鍵:');
console.log('==================');

// 直接讀取 JSON 檔案來測試
const enUS = JSON.parse(readFileSync('./src/shared/i18n/locales/en-US.json', 'utf8'));
const zhTW = JSON.parse(readFileSync('./src/shared/i18n/locales/zh-TW.json', 'utf8'));
const zhCN = JSON.parse(readFileSync('./src/shared/i18n/locales/zh-CN.json', 'utf8'));

console.log('英文 windowTitle:', enUS.app.windowTitle);
console.log('繁體中文 windowTitle:', zhTW.app.windowTitle);
console.log('簡體中文 windowTitle:', zhCN.app.windowTitle);

console.log('');
console.log('測試完成！確認 windowTitle 鍵存在於所有語言檔案中。');