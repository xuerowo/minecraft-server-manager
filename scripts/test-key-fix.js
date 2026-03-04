// 測試鍵名修正
import { readFileSync } from 'fs';

console.log('測試鍵名修正:');
console.log('=============');

// 測試正確的鍵名路徑
const enUS = JSON.parse(readFileSync('./src/shared/i18n/locales/en-US.json', 'utf8'));
const zhTW = JSON.parse(readFileSync('./src/shared/i18n/locales/zh-TW.json', 'utf8'));
const zhCN = JSON.parse(readFileSync('./src/shared/i18n/locales/zh-CN.json', 'utf8'));

console.log('測試 app.windowTitle 鍵:');
console.log('英文:', enUS.app.windowTitle);
console.log('繁體中文:', zhTW.app.windowTitle);
console.log('簡體中文:', zhCN.app.windowTitle);

console.log('');
console.log('測試 windowTitle 鍵 (錯誤的):');
console.log('英文:', enUS.windowTitle);
console.log('繁體中文:', zhTW.windowTitle);
console.log('簡體中文:', zhCN.windowTitle);

console.log('');
console.log('結論: 應該使用 app.windowTitle 而不是 windowTitle');