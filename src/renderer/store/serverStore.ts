import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { ServerInfo, LogEntry } from '@shared/types';

export interface ServerState {
  servers: ServerInfo[];
  currentServerId: string | null;
  logs: Record<string, LogEntry[]>;
  selectedServers: string[];
  
  // Actions
  setServers: (servers: ServerInfo[]) => void;
  addServer: (server: ServerInfo) => void;
  updateServer: (serverId: string, updates: Partial<ServerInfo>) => void;
  removeServer: (serverId: string) => void;
  setCurrentServer: (serverId: string | null) => void;
  updateServerStatus: (
    serverId: string, 
    status: ServerInfo['status'], 
    additionalData?: Partial<Pick<ServerInfo, 'playerCount' | 'maxPlayers' | 'lastStart'>>
  ) => void;
  
  // Log actions
  addLog: (serverId: string, logEntry: LogEntry) => void;
  clearLogs: (serverId: string) => void;
  getLogs: (serverId: string) => LogEntry[];
  
  // Selection actions
  selectServer: (serverId: string) => void;
  deselectServer: (serverId: string) => void;
  clearSelection: () => void;
  toggleServerSelection: (serverId: string) => void;
}

export const useServerStore = create<ServerState>()(
  subscribeWithSelector((set, get) => ({
    servers: [],
    currentServerId: null,
    logs: {},
    selectedServers: [],

    // Server management
    setServers: (servers) => set({ servers }),
    
    addServer: (server) => set((state) => ({
      servers: [...state.servers, server]
    })),
    
    updateServer: (serverId, updates) => set((state) => ({
      servers: state.servers.map(server =>
        server.id === serverId ? { ...server, ...updates } : server
      )
    })),
    
    removeServer: (serverId) => set((state) => {
      const newLogs = { ...state.logs };
      delete newLogs[serverId];
      
      return {
        servers: state.servers.filter(server => server.id !== serverId),
        logs: newLogs,
        currentServerId: state.currentServerId === serverId ? null : state.currentServerId,
        selectedServers: state.selectedServers.filter(id => id !== serverId)
      };
    }),
    
    setCurrentServer: (serverId) => set({ currentServerId: serverId }),
    
    updateServerStatus: (serverId, status, additionalData = {}) => set((state) => ({
      servers: state.servers.map(server =>
        server.id === serverId 
          ? { ...server, status, ...additionalData }
          : server
      )
    })),

    // Log management
    addLog: (serverId, logEntry) => set((state) => {
      const serverLogs = state.logs[serverId] || [];
      const maxLogs = 1000; // 限制日誌數量以避免記憶體問題
      
      const newLogs = [...serverLogs, logEntry];
      if (newLogs.length > maxLogs) {
        newLogs.splice(0, newLogs.length - maxLogs);
      }
      
      return {
        logs: {
          ...state.logs,
          [serverId]: newLogs
        }
      };
    }),
    
    clearLogs: (serverId) => set((state) => ({
      logs: {
        ...state.logs,
        [serverId]: []
      }
    })),
    
    getLogs: (serverId) => get().logs[serverId] || [],

    // Selection management
    selectServer: (serverId) => set((state) => ({
      selectedServers: [...new Set([...state.selectedServers, serverId])]
    })),
    
    deselectServer: (serverId) => set((state) => ({
      selectedServers: state.selectedServers.filter(id => id !== serverId)
    })),
    
    clearSelection: () => set({ selectedServers: [] }),
    
    toggleServerSelection: (serverId) => set((state) => {
      const isSelected = state.selectedServers.includes(serverId);
      return {
        selectedServers: isSelected
          ? state.selectedServers.filter(id => id !== serverId)
          : [...state.selectedServers, serverId]
      };
    })
  }))
);

// 選擇器函數
export const selectCurrentServer = (state: ServerState) =>
  state.currentServerId 
    ? state.servers.find(server => server.id === state.currentServerId)
    : null;

export const selectRunningServers = (state: ServerState) =>
  state.servers.filter(server => server.status === 'running');

export const selectServerById = (serverId: string) => (state: ServerState) =>
  state.servers.find(server => server.id === serverId);

export const selectServersByStatus = (status: ServerInfo['status']) => (state: ServerState) =>
  state.servers.filter(server => server.status === status);