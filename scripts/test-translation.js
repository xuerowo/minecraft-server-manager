import { i18n } from './dist/shared/i18n/index.js';

// Test the translation function with problematic keys
console.log('Testing translation keys...');

// Test keys that should work
console.log('query.port.label:', i18n.t('serverProperties.properties.query.port.label'));
console.log('rcon.port.label:', i18n.t('serverProperties.properties.rcon.port.label'));
console.log('rcon.password.label:', i18n.t('serverProperties.properties.rcon.password.label'));

// Test a key that should definitely work
console.log('server-port.label:', i18n.t('serverProperties.properties.server-port.label'));

console.log('Current language:', i18n.getLanguage());