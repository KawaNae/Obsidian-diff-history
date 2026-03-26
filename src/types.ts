export interface DiffRecord {
  id?: string;
  filePath: string;
  timestamp: number;
  patches: string;
  baseHash: string;
}

export interface FileSnapshot {
  filePath: string;
  content: string;
  lastModified: number;
}

export interface DiffHistorySettings {
  retentionDays: number;
  debounceMs: number;
  excludePatterns: string[];
  maxStorageMB: number;
}

export const DEFAULT_SETTINGS: DiffHistorySettings = {
  retentionDays: 7,
  debounceMs: 2000,
  excludePatterns: [],
  maxStorageMB: 200,
};
