// Test the translation logic directly
const zhCN = require('./src/shared/i18n/locales/zh-CN.json');
const serverPropertiesCN = require('./src/shared/i18n/locales/serverProperties-zh-CN.json');

// Simulate the merge that happens in i18n config
const mergedResources = { ...zhCN, ...serverPropertiesCN };

console.log('Testing translation logic for problematic keys...');

// Test the exact key resolution logic from the i18n system
function testKeyResolution(key) {
  console.log(`\nTesting key: ${key}`);
  
  const keys = key.split('.');
  let value = mergedResources;
  
  console.log(`Key parts: ${keys.join(' -> ')}`);
  
  for (const k of keys) {
    console.log(`  Processing: ${k}`);
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
      console.log(`    Found: ${typeof value === 'object' ? 'object' : JSON.stringify(value)}`);
    } else {
      console.log(`    NOT FOUND, would return default`);
      return key; // Return key as default
    }
  }
  
  return typeof value === 'string' ? value : key;
}

// Test the problematic keys
const testKeys = [
  'serverProperties.properties.query.port.label',
  'serverProperties.properties.rcon.port.label',
  'serverProperties.properties.rcon.password.label',
  'serverProperties.properties.server-port.label' // This should work for comparison
];

testKeys.forEach(key => {
  const result = testKeyResolution(key);
  console.log(`Result for ${key}: ${result}`);
  console.log('---');
});