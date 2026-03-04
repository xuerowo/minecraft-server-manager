// Minecraft 伺服器指令自動完成

export interface CommandSuggestion {
  command: string;
  description: string;
  syntax: string;
  category: string;
  examples?: string[];
}

export interface CommandHistory {
  command: string;
  timestamp: Date;
  success?: boolean;
}

export class MinecraftCommandAutoComplete {
  // 指令分類
  private static readonly COMMAND_CATEGORIES = {
    PLAYER: '玩家管理',
    WORLD: '世界管理',
    ADMIN: '管理指令',
    GAME: '遊戲規則',
    SYSTEM: '系統指令',
    DEBUG: '除錯指令',
  } as const;

  // 預定義指令列表
  private static readonly COMMANDS: CommandSuggestion[] = [
    // 玩家管理
    {
      command: 'kick',
      description: '踢出玩家',
      syntax: 'kick <player> [reason]',
      category: 'PLAYER',
      examples: ['kick Steve 違反規則', 'kick Alex'],
    },
    {
      command: 'ban',
      description: '封禁玩家',
      syntax: 'ban <player> [reason]',
      category: 'PLAYER',
      examples: ['ban Steve 作弊', 'ban Alex'],
    },
    {
      command: 'ban-ip',
      description: '封禁IP地址',
      syntax: 'ban-ip <ip|player> [reason]',
      category: 'PLAYER',
      examples: ['ban-ip 192.168.1.100', 'ban-ip Steve'],
    },
    {
      command: 'pardon',
      description: '解除玩家封禁',
      syntax: 'pardon <player>',
      category: 'PLAYER',
      examples: ['pardon Steve'],
    },
    {
      command: 'pardon-ip',
      description: '解除IP封禁',
      syntax: 'pardon-ip <ip>',
      category: 'PLAYER',
      examples: ['pardon-ip 192.168.1.100'],
    },
    {
      command: 'op',
      description: '給予玩家管理員權限',
      syntax: 'op <player>',
      category: 'PLAYER',
      examples: ['op Steve'],
    },
    {
      command: 'deop',
      description: '移除玩家管理員權限',
      syntax: 'deop <player>',
      category: 'PLAYER',
      examples: ['deop Steve'],
    },
    {
      command: 'whitelist',
      description: '白名單管理',
      syntax: 'whitelist <add|remove|list|on|off|reload> [player]',
      category: 'PLAYER',
      examples: [
        'whitelist add Steve',
        'whitelist remove Alex', 
        'whitelist list',
        'whitelist on',
        'whitelist off',
      ],
    },

    // 世界管理
    {
      command: 'time',
      description: '設定時間',
      syntax: 'time <set|add|query> <value>',
      category: 'WORLD',
      examples: [
        'time set day',
        'time set night',
        'time set 1000',
        'time add 1000',
        'time query daytime',
      ],
    },
    {
      command: 'weather',
      description: '設定天氣',
      syntax: 'weather <clear|rain|thunder> [duration]',
      category: 'WORLD',
      examples: [
        'weather clear',
        'weather rain 300',
        'weather thunder 600',
      ],
    },
    {
      command: 'seed',
      description: '顯示世界種子',
      syntax: 'seed',
      category: 'WORLD',
    },
    {
      command: 'tp',
      description: '傳送玩家',
      syntax: 'tp <player> <x y z>',
      category: 'WORLD',
      examples: ['tp Steve 100 64 200'],
    },
    {
      command: 'teleport',
      description: '傳送玩家（詳細版）',
      syntax: 'teleport <player> <x y z> [yaw] [pitch]',
      category: 'WORLD',
      examples: ['teleport Steve 100 64 200 90 0'],
    },

    // 管理指令
    {
      command: 'say',
      description: '向所有玩家發送訊息',
      syntax: 'say <message>',
      category: 'ADMIN',
      examples: ['say 伺服器將在5分鐘後重啟'],
    },
    {
      command: 'tell',
      description: '向指定玩家發送私訊',
      syntax: 'tell <player> <message>',
      category: 'ADMIN',
      examples: ['tell Steve 請注意你的行為'],
    },
    {
      command: 'title',
      description: '向玩家顯示標題',
      syntax: 'title <player> <title|subtitle|actionbar|clear|reset> [text]',
      category: 'ADMIN',
      examples: [
        'title @a title "歡迎來到伺服器"',
        'title Steve subtitle "請遵守規則"',
      ],
    },

    // 遊戲規則
    {
      command: 'gamerule',
      description: '設定遊戲規則',
      syntax: 'gamerule <rule> [value]',
      category: 'GAME',
      examples: [
        'gamerule doDaylightCycle false',
        'gamerule doMobSpawning false',
        'gamerule keepInventory true',
        'gamerule mobGriefing false',
      ],
    },
    {
      command: 'difficulty',
      description: '設定遊戲難度',
      syntax: 'difficulty <peaceful|easy|normal|hard>',
      category: 'GAME',
      examples: [
        'difficulty peaceful',
        'difficulty easy',
        'difficulty normal', 
        'difficulty hard',
      ],
    },

    // 系統指令
    {
      command: 'list',
      description: '列出線上玩家',
      syntax: 'list',
      category: 'SYSTEM',
    },
    {
      command: 'help',
      description: '顯示幫助資訊',
      syntax: 'help [command]',
      category: 'SYSTEM',
      examples: ['help', 'help tp'],
    },
    {
      command: 'stop',
      description: '停止伺服器',
      syntax: 'stop',
      category: 'SYSTEM',
    },
    {
      command: 'save-all',
      description: '儲存世界',
      syntax: 'save-all [flush]',
      category: 'SYSTEM',
      examples: ['save-all', 'save-all flush'],
    },
    {
      command: 'save-on',
      description: '啟用自動儲存',
      syntax: 'save-on',
      category: 'SYSTEM',
    },
    {
      command: 'save-off',
      description: '停用自動儲存',
      syntax: 'save-off',
      category: 'SYSTEM',
    },

    // 除錯指令
    {
      command: 'debug',
      description: '除錯指令',
      syntax: 'debug <start|stop|report>',
      category: 'DEBUG',
      examples: ['debug start', 'debug stop'],
    },
  ];

  private commandHistory: CommandHistory[] = [];

  /**
   * 獲取指令建議
   */
  public getSuggestions(input: string, limit: number = 10): CommandSuggestion[] {
    const query = input.toLowerCase().trim();
    
    if (!query) {
      return MinecraftCommandAutoComplete.COMMANDS.slice(0, limit);
    }

    return MinecraftCommandAutoComplete.COMMANDS
      .filter(cmd => 
        cmd.command.toLowerCase().includes(query) ||
        cmd.description.toLowerCase().includes(query) ||
        cmd.syntax.toLowerCase().includes(query)
      )
      .sort((a, b) => {
        // 優先顯示指令名稱匹配的結果
        const aStartsWith = a.command.toLowerCase().startsWith(query);
        const bStartsWith = b.command.toLowerCase().startsWith(query);
        
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        
        return a.command.localeCompare(b.command);
      })
      .slice(0, limit);
  }

  /**
   * 獲取指令歷史
   */
  public getCommandHistory(): CommandHistory[] {
    return [...this.commandHistory].reverse(); // 最新的在前
  }

  /**
   * 添加指令到歷史
   */
  public addToHistory(command: string, success: boolean = true): void {
    this.commandHistory.push({
      command: command.trim(),
      timestamp: new Date(),
      success,
    });

    // 限制歷史記錄數量
    if (this.commandHistory.length > 100) {
      this.commandHistory.shift();
    }
  }

  /**
   * 清除歷史記錄
   */
  public clearHistory(): void {
    this.commandHistory = [];
  }

  /**
   * 獲取最近使用的指令
   */
  public getRecentCommands(limit: number = 5): string[] {
    const uniqueCommands = new Set<string>();
    const result: string[] = [];

    for (let i = this.commandHistory.length - 1; i >= 0 && result.length < limit; i--) {
      const cmd = this.commandHistory[i].command;
      if (!uniqueCommands.has(cmd)) {
        uniqueCommands.add(cmd);
        result.push(cmd);
      }
    }

    return result;
  }

  /**
   * 根據分類獲取指令
   */
  public getCommandsByCategory(category?: keyof typeof MinecraftCommandAutoComplete.COMMAND_CATEGORIES): CommandSuggestion[] {
    if (!category) {
      return MinecraftCommandAutoComplete.COMMANDS;
    }
    
    return MinecraftCommandAutoComplete.COMMANDS.filter(cmd => cmd.category === category);
  }

  /**
   * 獲取所有分類
   */
  public getCategories(): Array<{ key: string; name: string; count: number }> {
    return Object.entries(MinecraftCommandAutoComplete.COMMAND_CATEGORIES).map(([key, name]) => ({
      key,
      name,
      count: MinecraftCommandAutoComplete.COMMANDS.filter(cmd => cmd.category === key).length,
    }));
  }

  /**
   * 驗證指令語法
   */
  public validateCommand(command: string): { isValid: boolean; suggestion?: CommandSuggestion; error?: string } {
    const trimmed = command.trim();
    
    if (!trimmed) {
      return { isValid: false, error: '指令不能為空' };
    }

    const commandName = trimmed.split(' ')[0];
    const suggestion = MinecraftCommandAutoComplete.COMMANDS.find(cmd => cmd.command === commandName);

    if (!suggestion) {
      return { 
        isValid: false, 
        error: `未知指令: ${commandName}。輸入 "help" 查看可用指令。` 
      };
    }

    return { isValid: true, suggestion };
  }
}