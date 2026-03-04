import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Card, 
  Input, 
  Button, 
  Space, 
  Typography, 
  message, 
  Empty, 
  AutoComplete,
  Select,
  Tooltip,
  Badge,
  Dropdown,
  Menu
} from 'antd';
import { 
  SendOutlined, 
  ClearOutlined, 
  DownloadOutlined,
  HistoryOutlined,
  FilterOutlined,
  BulbOutlined,
  PlayCircleOutlined,
  StopOutlined
} from '@ant-design/icons';
import { useServerStore } from '../store/serverStore';
import { useI18n } from '../hooks/useI18n';
import { MinecraftLogParser, type ParsedLogEntry } from '../utils/logParser';
import { MinecraftCommandAutoComplete, type CommandSuggestion } from '../utils/commandAutoComplete';

const { Title, Text } = Typography;

export const ServerConsole: React.FC = () => {
  const { serverId } = useParams<{ serverId: string }>();
  const { t } = useI18n();
  const [command, setCommand] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [operationLoading, setOperationLoading] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState<{
    level?: ParsedLogEntry['level'];
    search?: string;
  }>({});
  const [autoScroll, setAutoScroll] = useState(true);
  const [systemUsage, setSystemUsage] = useState<{
    cpuUsage: string;
    memoryUsage: string;
    usedMemory: string;
    totalMemory: string;
  }>({
    cpuUsage: '0.0%',
    memoryUsage: '0.0%',
    usedMemory: '0 B',
    totalMemory: '0 B'
  });
  
  const consoleRef = useRef<HTMLDivElement>(null);
  const commandAutoComplete = useRef(new MinecraftCommandAutoComplete());
  
  const { servers, getLogs, clearLogs } = useServerStore();
  const server = serverId ? servers.find(s => s.id === serverId) : null;
  const rawLogs = serverId ? getLogs(serverId) : [];
  
  // 解析並過濾日誌
  const parsedLogs = rawLogs.map(log => MinecraftLogParser.parseLogEntry(log.message));
  const filteredLogs = MinecraftLogParser.filterLogs(parsedLogs, logFilter);

  useEffect(() => {
    // 自動滾動到底部
    if (autoScroll && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  useEffect(() => {
    // 定期獲取系統使用率
    const updateSystemUsage = async () => {
      try {
        const usage = await window.electronAPI.getSystemUsage();
        setSystemUsage(usage.formatted);
      } catch (error) {
        console.error('獲取系統使用率失敗:', error);
      }
    };

    updateSystemUsage();
    const interval = setInterval(updateSystemUsage, 2000); // 每2秒更新一次

    return () => clearInterval(interval);
  }, []);

  const handleSendCommand = async () => {
    if (!serverId || !command.trim() || !server) {
      return;
    }

    if (server.status !== 'running') {
      message.warning(t('console.serverNotRunning'));
      return;
    }

    // 驗證指令
    const validation = commandAutoComplete.current.validateCommand(command.trim());
    if (!validation.isValid) {
      message.warning(validation.error);
      return;
    }

    setIsLoading(true);
    try {
      await window.electronAPI.sendServerCommand(serverId, command.trim());
      commandAutoComplete.current.addToHistory(command.trim(), true);
      setCommand('');
    } catch (error: any) {
      commandAutoComplete.current.addToHistory(command.trim(), false);
      message.error(t('console.sendCommandFailed', { 
        error: error.message || t('errors.unknownError') 
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendCommand();
    }
  };

  const handleServerAction = async (action: 'start' | 'stop') => {
    if (!serverId) return;
    
    setOperationLoading(action);
    
    try {
      if (action === 'start') {
        await window.electronAPI.startServer(serverId);
        message.success(t('success.serverStarting', { name: server?.name }));
      } else {
        await window.electronAPI.stopServer(serverId);
        message.success(t('success.serverStopping', { name: server?.name }));
      }
    } catch (error: any) {
      message.error(t('errors.operationFailed', { error: error.message || t('errors.unknownError') }));
    } finally {
      setOperationLoading(null);
    }
  };

  const handleClearLogs = () => {
    if (serverId) {
      clearLogs(serverId);
      message.success(t('console.logsCleared'));
    }
  };

  const handleExportLogs = () => {
    if (!serverId || filteredLogs.length === 0) {
      message.warning(t('console.noLogsToExport'));
      return;
    }

    const logText = filteredLogs
      .map(log => `[${log.timestamp.toLocaleString()}] [${log.level}] [${log.source}] ${log.message}`)
      .join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${server?.name || 'server'}_logs_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    message.success(t('console.logsExported'));
  };

  const formatLogMessage = (log: ParsedLogEntry, index: number) => {
    return (
      <div 
        key={`${log.timestamp.getTime()}-${index}`} 
        className="console-line hover:bg-gray-800 px-2 py-1 rounded"
        style={{ color: log.color }}
      >
        <span className="timestamp text-gray-500 text-xs mr-3 font-mono">
          [{log.timestamp.toLocaleTimeString()}]
        </span>
        <span className="level text-xs mr-3 font-bold min-w-[50px] inline-block">
          [{log.level}]
        </span>
        <span className="source text-xs mr-3 text-gray-400 min-w-[80px] inline-block">
          [{log.source}]
        </span>
        <span className="message font-mono text-sm">{log.message}</span>
      </div>
    );
  };

  // 獲取指令建議
  const getCommandSuggestions = (searchText: string) => {
    const suggestions = commandAutoComplete.current.getSuggestions(searchText, 8);
    return suggestions.map(suggestion => ({
      value: suggestion.command,
      label: (
        <div className="py-1">
          <div className="font-semibold">{suggestion.command}</div>
          <div className="text-xs text-gray-400">{suggestion.description}</div>
          <div className="text-xs text-gray-500 font-mono">{suggestion.syntax}</div>
        </div>
      ),
    }));
  };

  // 歷史指令選單
  const historyMenu = (
    <Menu>
      {commandAutoComplete.current.getRecentCommands().map((cmd, index) => (
        <Menu.Item key={index} onClick={() => setCommand(cmd)}>
          <span className="font-mono">{cmd}</span>
        </Menu.Item>
      ))}
      <Menu.Divider />
      <Menu.Item onClick={() => commandAutoComplete.current.clearHistory()}>
        {t('console.clearHistory')}
      </Menu.Item>
    </Menu>
  );

  // 過濾選單
  const filterMenu = (
    <Menu>
      <Menu.SubMenu key="level" title={t('console.logLevel')}>
        <Menu.Item 
          key="all" 
          onClick={() => setLogFilter(prev => ({ ...prev, level: undefined }))}
        >
          {t('console.showAll')}
        </Menu.Item>
        {(['INFO', 'WARN', 'ERROR', 'DEBUG', 'TRACE'] as const).map(level => (
          <Menu.Item 
            key={level} 
            onClick={() => setLogFilter(prev => ({ ...prev, level }))}
          >
            <Badge color={level === 'ERROR' ? 'red' : level === 'WARN' ? 'orange' : 'green'} />
            {level}
          </Menu.Item>
        ))}
      </Menu.SubMenu>
      <Menu.Divider />
      <Menu.Item onClick={() => setAutoScroll(!autoScroll)}>
        {autoScroll ? t('console.disable') : t('console.enable')} {t('console.autoScroll')}
      </Menu.Item>
    </Menu>
  );

  if (!server) {
    return (
      <div className="p-6">
        <Card>
          <Empty
            description={t('console.selectServerFirst')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-4">
        <Title level={3} className="!text-white !mb-2">
          {server.name} - {t('console.consoleTitle')}
        </Title>
        <div className="flex items-center">
          <span className="text-gray-100 mr-2">{t('server.status.status')}:</span>
          <Badge 
            status={
              server.status === 'running' ? 'success' :
              server.status === 'starting' ? 'processing' :
              server.status === 'stopping' ? 'warning' :
              'error'
            }
            text={
              <span className="text-gray-100 font-medium">
                {t(`server.status.${server.status}`)}
              </span>
            }
          />
        </div>
        
        {/* 系統資源使用率顯示 */}
        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
          <div className="flex items-center">
            <span className="mr-1">CPU:</span>
            <span className="font-mono">{systemUsage.cpuUsage}</span>
          </div>
          <div className="flex items-center">
            <span className="mr-1">RAM:</span>
            <span className="font-mono">{systemUsage.memoryUsage}</span>
            <span className="mx-1">({systemUsage.usedMemory} / {systemUsage.totalMemory})</span>
          </div>
        </div>
      </div>

      {/* 控制台輸出區域 */}
      <Card className="flex-1 mb-4 flex flex-col">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center space-x-4">
            <Title level={5} className="!mb-0">{t('console.realtimeLogs')}</Title>
            <Space>
              <Badge count={filteredLogs.length} showZero />
              <Text type="secondary" className="text-sm">
                {logFilter.level && `[${logFilter.level}] `}
                {logFilter.search && `${t('console.search')}: "${logFilter.search}"`}
              </Text>
            </Space>
          </div>
          <Space>
            {/* 伺服器控制按鈕 */}
            {server.status === 'stopped' && (
              <Button
                size="small"
                type="primary"
                icon={<PlayCircleOutlined />}
                loading={operationLoading === 'start'}
                onClick={() => handleServerAction('start')}
              >
                {t('server.start')}
              </Button>
            )}
            {(server.status === 'running' || server.status === 'starting') && (
              <Button
                size="small"
                danger
                icon={<StopOutlined />}
                loading={operationLoading === 'stop'}
                onClick={() => handleServerAction('stop')}
              >
                {t('server.stop')}
              </Button>
            )}
            <Input.Search
              size="small"
              placeholder={t('console.searchLogs')}
              style={{ width: 150 }}
              value={logFilter.search}
              onChange={(e) => setLogFilter(prev => ({ ...prev, search: e.target.value || undefined }))}
              allowClear
            />
            <Dropdown overlay={filterMenu} trigger={['click']}>
              <Button size="small" icon={<FilterOutlined />}>
                {t('console.filter')} {(logFilter.level || logFilter.search) && <Badge dot />}
              </Button>
            </Dropdown>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={handleExportLogs}
              disabled={filteredLogs.length === 0}
            >
              {t('settings.export')}
            </Button>
            <Button
              size="small"
              icon={<ClearOutlined />}
              onClick={handleClearLogs}
              disabled={rawLogs.length === 0}
            >
              {t('console.clear')}
            </Button>
          </Space>
        </div>

        <div
          ref={consoleRef}
          className="console-output flex-1 min-h-0 relative"
          style={{ maxHeight: 'calc(100vh - 300px)' }}
          onScroll={(e) => {
            const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
            const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
            setAutoScroll(isAtBottom);
          }}
        >
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Text type="secondary">
                {rawLogs.length === 0 
                  ? (server.status === 'running' ? t('console.waitingForLogs') : t('console.serverNotRunningNoLogs'))
                  : t('console.noMatchingLogs')
                }
              </Text>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredLogs.map((log, index) => formatLogMessage(log, index))}
            </div>
          )}
          
          {!autoScroll && (
            <div className="absolute bottom-4 right-4">
              <Button 
                size="small" 
                type="primary"
                onClick={() => {
                  if (consoleRef.current) {
                    consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
                    setAutoScroll(true);
                  }
                }}
              >
                {t('console.scrollToBottom')}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* 指令輸入區域 */}
      <Card>
        <div className="flex space-x-2 mb-3">
          <AutoComplete
            className="flex-1"
            value={command}
            onChange={setCommand}
            onKeyDown={handleKeyPress}
            disabled={server.status !== 'running' || isLoading}
            placeholder={
              server.status === 'running' 
                ? t('console.inputCommandPlaceholder') 
                : t('console.serverNotRunning')
            }
            options={getCommandSuggestions(command)}
            filterOption={false}
          >
            <Input 
              className="console-input"
              prefix={
                <span className="text-minecraft-green font-mono font-bold">
                  {server.status === 'running' ? '>' : '#'}
                </span>
              }
            />
          </AutoComplete>
          
          <Dropdown overlay={historyMenu} trigger={['click']} disabled={isLoading}>
            <Button 
              icon={<HistoryOutlined />}
              title={t('console.commandHistory')}
              disabled={server.status !== 'running' || isLoading}
            />
          </Dropdown>
          
          <Tooltip title={t('console.commandHelp')}>
            <Button 
              icon={<BulbOutlined />}
              onClick={() => {
                const categories = commandAutoComplete.current.getCategories();
                const helpText = categories.map(cat => 
                  t('console.commandCategory', { name: cat.name, count: cat.count })
                ).join('\n');
                message.info(helpText);
              }}
              disabled={isLoading}
            />
          </Tooltip>
          
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSendCommand}
            loading={isLoading}
            disabled={server.status !== 'running' || !command.trim()}
          >
            {t('console.send')}
          </Button>
        </div>
        
        <div className="flex justify-between items-center text-xs text-gray-400">
          <Space>
            <Text type="secondary">
              {t('console.hint')}
            </Text>
          </Space>
          <Space>
            {server.status === 'running' && (
              <Text type="secondary" className="text-minecraft-green">
                • {t('console.serverReady')}
              </Text>
            )}
            {commandAutoComplete.current.getRecentCommands().length > 0 && (
              <Text type="secondary">
                {t('console.historyCommands', { count: commandAutoComplete.current.getRecentCommands().length })}
              </Text>
            )}
          </Space>
        </div>
      </Card>
    </div>
  );
};