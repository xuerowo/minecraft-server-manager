// Test the fixed translation logic
const zhCN = require('./src/shared/i18n/locales/zh-CN.json');
const serverPropertiesCN = require('./src/shared/i18n/locales/serverProperties-zh-CN.json');

// Simulate the i18n resources
const resources = { ...zhCN, ...serverPropertiesCN };

// Simulate the fixed translation function
function t(key, params, defaultValue) {
  // Special handling for server properties with dots in keys
  if (key.startsWith('serverProperties.properties.')) {
    const remainingKey = key.substring('serverProperties.properties.'.length);
    
    // Check if this is a server property key that contains dots
    const serverProps = resources.serverProperties?.properties;
    if (serverProps) {
      // Look for exact match first (for keys with dots like 'query.port')
      for (const propKey of Object.keys(serverProps)) {
        if (remainingKey.startsWith(propKey + '.')) {
          const subKey = remainingKey.substring(propKey.length + 1); // +1 for the dot
          const propValue = serverProps[propKey];
          
          if (propValue && typeof propValue === 'object' && subKey in propValue) {
            let result = propValue[subKey];
            
            // Replace parameters
            if (params && typeof result === 'string') {
              Object.entries(params).forEach(([paramKey, paramValue]) => {
                result = result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
              });
            }
            
            return typeof result === 'string' ? result : (defaultValue || key);
          }
        }
      }
    }
  }
  
  // Default handling for regular keys
  const keys = key.split('.');
  let value = resources;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return defaultValue || key;
    }
  }
  
  return typeof value === 'string' ? value : (defaultValue || key);
}

// Test the problematic keys
const testKeys = [
  'serverProperties.properties.query.port.label',
  'serverProperties.properties.rcon.port.label',
  'serverProperties.properties.rcon.password.label',
  'serverProperties.properties.server-port.label' // This should work for comparison
];

console.log('Testing fixed translation function...');

testKeys.forEach(key => {
  const result = t(key);
  console.log(`Key: ${key}`);
  console.log(`Result: "${result}"`);
  console.log(`Is fallback? ${result === key ? 'YES' : 'NO'}`);
  console.log('---');
});