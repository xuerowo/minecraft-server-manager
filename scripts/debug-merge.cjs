// Debug the merging of locale files
const zhCN = require('./src/shared/i18n/locales/zh-CN.json');
const serverPropertiesCN = require('./src/shared/i18n/locales/serverProperties-zh-CN.json');

console.log('Main zh-CN serverProperties keys:', Object.keys(zhCN.serverProperties || {}));
console.log('Separate serverPropertiesCN keys:', Object.keys(serverPropertiesCN.serverProperties || {}));

// Simulate the merge
const merged = { ...zhCN, ...serverPropertiesCN };
console.log('Merged serverProperties keys:', Object.keys(merged.serverProperties || {}));

// Check if the problematic keys exist
const problematicKeys = ['query.port', 'rcon.port', 'rcon.password'];
problematicKeys.forEach(key => {
  const exists = merged.serverProperties?.properties?.[key] !== undefined;
  console.log(`Key ${key} exists: ${exists}`);
  if (exists) {
    console.log(`  Label: ${merged.serverProperties.properties[key].label}`);
    console.log(`  Description: ${merged.serverProperties.properties[key].description}`);
  }
});