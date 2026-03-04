// Minecraft 伺服器日誌解析工具

export interface ParsedLogEntry {
  timestamp: Date;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'TRACE';
  source: string;
  message: string;
  rawMessage: string;
  color: string;
}

export class MinecraftLogParser {
  // 日誌等級顏色映射
  private static readonly LOG_COLORS = {
    INFO: '#ffffff',      // 白色
    WARN: '#ffff55',      // 黃色  
    ERROR: '#ff5555',     // 紅色
    DEBUG: '#aaaaaa',     // 灰色
    TRACE: '#888888',     // 深灰色
  };

  // 特殊訊息顏色
  private static readonly MESSAGE_COLORS = {
    joined: '#55ff55',    // 玩家加入 - 綠色
    left: '#ff8c00',      // 玩家離開 - 橙色
    chat: '#55ffff',      // 聊天訊息 - 青色
    command: '#ffaa00',   // 指令執行 - 橙黃色
    achievement: '#aa00ff', // 成就 - 紫色
  };

  // 日誌格式正則表達式
  private static readonly LOG_PATTERNS = [
    // [HH:mm:ss] [Thread/LEVEL]: Message
    /^\[(\d{2}:\d{2}:\d{2})\] \[([^\/]+)\/([A-Z]+)\]: (.+)$/,
    // [HH:mm:ss INFO]: Message  
    /^\[(\d{2}:\d{2}:\d{2}) ([A-Z]+)\]: (.+)$/,
    // [YYYY-MM-DD HH:mm:ss] [LEVEL]: Message
    /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] \[([A-Z]+)\]: (.+)$/,
  ];

  /**
   * 解析單條日誌
   */
  public static parseLogEntry(rawMessage: string): ParsedLogEntry {
    const now = new Date();
    
    // 嘗試匹配不同的日誌格式
    for (const pattern of this.LOG_PATTERNS) {
      const match = rawMessage.match(pattern);
      if (match) {
        return this.createParsedEntry(match, rawMessage, now);
      }
    }

    // 如果無法解析，返回預設格式
    return {
      timestamp: now,
      level: 'INFO',
      source: 'Server',
      message: rawMessage.trim(),
      rawMessage,
      color: this.LOG_COLORS.INFO,
    };
  }

  /**
   * 從正則匹配結果創建解析條目
   */
  private static createParsedEntry(
    match: RegExpMatchArray,
    rawMessage: string,
    baseTime: Date
  ): ParsedLogEntry {
    let timestamp: Date;
    let level: ParsedLogEntry['level'];
    let source: string;
    let message: string;

    if (match.length === 5) {
      // [HH:mm:ss] [Thread/LEVEL]: Message
      const [, timeStr, thread, levelStr, msg] = match;
      timestamp = this.parseTime(timeStr, baseTime);
      level = this.parseLevel(levelStr);
      source = thread;
      message = msg;
    } else if (match.length === 4) {
      const [, timeStr, levelStr, msg] = match;
      if (timeStr.includes('-')) {
        // [YYYY-MM-DD HH:mm:ss] [LEVEL]: Message
        timestamp = new Date(timeStr);
        level = this.parseLevel(levelStr);
        source = 'Server';
        message = msg;
      } else {
        // [HH:mm:ss INFO]: Message
        timestamp = this.parseTime(timeStr, baseTime);
        level = this.parseLevel(levelStr);
        source = 'Server';
        message = msg;
      }
    } else {
      timestamp = baseTime;
      level = 'INFO';
      source = 'Server';
      message = rawMessage;
    }

    const color = this.determineColor(level, message);

    return {
      timestamp,
      level,
      source,
      message: message.trim(),
      rawMessage,
      color,
    };
  }

  /**
   * 解析時間字串
   */
  private static parseTime(timeStr: string, baseDate: Date): Date {
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    const date = new Date(baseDate);
    date.setHours(hours, minutes, seconds, 0);
    return date;
  }

  /**
   * 解析日誌等級
   */
  private static parseLevel(levelStr: string): ParsedLogEntry['level'] {
    const upperLevel = levelStr.toUpperCase();
    if (upperLevel in this.LOG_COLORS) {
      return upperLevel as ParsedLogEntry['level'];
    }
    return 'INFO';
  }

  /**
   * 根據日誌等級和內容確定顏色
   */
  private static determineColor(level: ParsedLogEntry['level'], message: string): string {
    // 特殊訊息檢查
    if (message.includes('joined the game')) {
      return this.MESSAGE_COLORS.joined;
    }
    if (message.includes('left the game')) {
      return this.MESSAGE_COLORS.left;
    }
    if (message.includes('<') && message.includes('>')) {
      return this.MESSAGE_COLORS.chat;
    }
    if (message.includes('issued server command')) {
      return this.MESSAGE_COLORS.command;
    }
    if (message.includes('has made the advancement') || message.includes('has completed the challenge')) {
      return this.MESSAGE_COLORS.achievement;
    }

    // 預設使用等級顏色
    return this.LOG_COLORS[level];
  }

  /**
   * 批次解析日誌
   */
  public static parseLogEntries(rawMessages: string[]): ParsedLogEntry[] {
    return rawMessages.map(msg => this.parseLogEntry(msg));
  }

  /**
   * 過濾日誌
   */
  public static filterLogs(
    logs: ParsedLogEntry[],
    options: {
      level?: ParsedLogEntry['level'];
      source?: string;
      search?: string;
      startTime?: Date;
      endTime?: Date;
    }
  ): ParsedLogEntry[] {
    return logs.filter(log => {
      if (options.level && log.level !== options.level) {
        return false;
      }
      if (options.source && log.source !== options.source) {
        return false;
      }
      if (options.search && !log.message.toLowerCase().includes(options.search.toLowerCase())) {
        return false;
      }
      if (options.startTime && log.timestamp < options.startTime) {
        return false;
      }
      if (options.endTime && log.timestamp > options.endTime) {
        return false;
      }
      return true;
    });
  }
}