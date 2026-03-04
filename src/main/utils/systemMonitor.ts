import * as os from 'os';

interface SystemUsage {
  cpuUsage: number;
  memoryUsage: number;
  totalMemory: number;
  freeMemory: number;
  uptime: number;
}

export class SystemMonitor {
  private previousCpuInfo: NodeJS.CpuInfo[] = [];
  
  constructor() {
    this.previousCpuInfo = [];
  }

  getSystemUsage(): SystemUsage {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;
    
    // 使用更簡單的 CPU 使用率計算
    // 對於演示目的，使用一個簡單的模擬值
    const cpuUsage = Math.random() * 30 + 5; // 5-35% 的隨機值
    
    return {
      cpuUsage: Math.round(cpuUsage * 100) / 100, // 四捨五入到小數點後兩位
      memoryUsage: Math.round(memoryUsage * 100) / 100,
      totalMemory: totalMemory,
      freeMemory: freeMemory,
      uptime: os.uptime()
    };
  }

  formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
  }

  formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }
}