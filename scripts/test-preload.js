// Simple test to check if getServerListFromPath method is available
console.log('Testing electronAPI methods...');

if (typeof window !== 'undefined' && window.electronAPI) {
  console.log('electronAPI found:', Object.keys(window.electronAPI));
  
  if (typeof window.electronAPI.getServerListFromPath === 'function') {
    console.log('getServerListFromPath method is available!');
    
    // Test the method
    window.electronAPI.getServerListFromPath('C:\\')
      .then(servers => {
        console.log('Test successful! Found servers:', servers);
      })
      .catch(error => {
        console.error('Test failed:', error);
      });
  } else {
    console.error('getServerListFromPath method NOT found!');
  }
} else {
  console.error('electronAPI not available');
}