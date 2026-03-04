// 測試窗口標題國際化功能
import { i18n } from './dist/shared/i18n.cjs';

console.log('測試窗口標題國際化功能:');
console.log('========================');

// 測試英文
console.log('英文 (en-US):');
i18n.setLanguage('en-US');
console.log('windowTitle:', i18n.t('windowTitle'));
console.log('');

// 測試繁體中文
console.log('繁體中文 (zh-TW):');
i18n.setLanguage('zh-TW');
console.log('windowTitle:', i18n.t('windowTitle'));
console.log('');

// 測試簡體中文
console.log('簡體中文 (zh-CN):');
i18n.setLanguage('zh-CN');
console.log('windowTitle:', i18n.t('windowTitle'));
console.log('');

console.log('測試完成！');