// 調試 i18n 語言切換問題
import { i18n } from './src/shared/i18n/index.ts';

console.log('調試 i18n 語言切換問題:');
console.log('========================');

console.log('初始語言:', i18n.getLanguage());
console.log('初始 windowTitle:', i18n.t('windowTitle'));

console.log('');
console.log('切換到英文...');
i18n.setLanguage('en-US');
console.log('當前語言:', i18n.getLanguage());
console.log('英文 windowTitle:', i18n.t('windowTitle'));

console.log('');
console.log('切換到繁體中文...');
i18n.setLanguage('zh-TW');
console.log('當前語言:', i18n.getLanguage());
console.log('繁體中文 windowTitle:', i18n.t('windowTitle'));

console.log('');
console.log('切換到簡體中文...');
i18n.setLanguage('zh-CN');
console.log('當前語言:', i18n.getLanguage());
console.log('簡體中文 windowTitle:', i18n.t('windowTitle'));

console.log('');
console.log('測試完成！');