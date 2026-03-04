// Test the i18n system directly from source
import { i18n } from './src/shared/i18n/index.ts';

console.log('Testing i18n translation system...');
console.log('Current language:', i18n.getLanguage());

// Test problematic keys
const testKeys = [
  'serverProperties.properties.query.port.label',
  'serverProperties.properties.rcon.port.label', 
  'serverProperties.properties.rcon.password.label',
  'serverProperties.properties.server-port.label' // This should work
];

testKeys.forEach(key => {
  const result = i18n.t(key);
  console.log(`Key: ${key}`);
  console.log(`Result: "${result}"`);
  console.log(`Is fallback? ${result === key ? 'YES' : 'NO'}`);
  console.log('---');
});

// Test with different languages
console.log('\nTesting with zh-CN:');
i18n.setLanguage('zh-CN');
console.log('Current language:', i18n.getLanguage());

testKeys.forEach(key => {
  const result = i18n.t(key);
  console.log(`Key: ${key} -> "${result}"`);
});

console.log('\nTesting with en-US:');
i18n.setLanguage('en-US');
console.log('Current language:', i18n.getLanguage());

testKeys.forEach(key => {
  const result = i18n.t(key);
  console.log(`Key: ${key} -> "${result}"`);
});