type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  ts: string;
  level: LogLevel;
  scope: string;
  msg: string;
  data?: any;
  code?: string;
}

const BUFFER_KEY = '__app_log_buffer';
const MAX_BUFFER = 200;

function nowIso() { return new Date().toISOString(); }

function pushBuffer(e: LogEntry) {
  try {
    const raw = localStorage.getItem(BUFFER_KEY);
    const arr: LogEntry[] = raw ? JSON.parse(raw) : [];
    arr.push(e);
    if (arr.length > MAX_BUFFER) arr.splice(0, arr.length - MAX_BUFFER);
    localStorage.setItem(BUFFER_KEY, JSON.stringify(arr));
  } catch {}
}

function fmt(level: LogLevel, scope: string, msg: string, data?: any, code?: string) {
  const entry: LogEntry = { ts: nowIso(), level, scope, msg, data, code };
  const prefix = `[${entry.ts}] [${level.toUpperCase()}] [${scope}]${code ? `(${code})` : ''} ${msg}`;
  if (level === 'error') console.error(prefix, data ?? '');
  else if (level === 'warn') console.warn(prefix, data ?? '');
  else if (level === 'debug') console.debug(prefix, data ?? '');
  else console.log(prefix, data ?? '');
  if (level === 'warn' || level === 'error') pushBuffer(entry);
  return entry;
}

export const logger = {
  debug: (scope: string, msg: string, data?: any) => fmt('debug', scope, msg, data),
  info: (scope: string, msg: string, data?: any) => fmt('info', scope, msg, data),
  warn: (scope: string, msg: string, data?: any, code?: string) => fmt('warn', scope, msg, data, code),
  error: (scope: string, msg: string, data?: any, code?: string) => fmt('error', scope, msg, data, code),
  getBuffer: (): LogEntry[] => {
    try { return JSON.parse(localStorage.getItem(BUFFER_KEY) || '[]'); } catch { return []; }
  },
  clearBuffer: () => { try { localStorage.removeItem(BUFFER_KEY); } catch {} },
  exportBuffer: () => {
    const b = logger.getBuffer();
    const blob = new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `logs-${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url);
  }
};

// 错误码表
export const ERR = {
  SETTINGS_READ: 'E_SETTINGS_READ',
  SETTINGS_WRITE: 'E_SETTINGS_WRITE',
  SETTINGS_VALIDATE: 'E_SETTINGS_VALIDATE',
  ORDERS_READ: 'E_ORDERS_READ',
  ORDERS_WRITE: 'E_ORDERS_WRITE',
  ORDERS_VALIDATE: 'E_ORDERS_VALIDATE',
  TABLES_READ: 'E_TABLES_READ',
  TABLES_WRITE: 'E_TABLES_WRITE',
  INVENTORY_READ: 'E_INVENTORY_READ',
  INVENTORY_WRITE: 'E_INVENTORY_WRITE',
  STORAGE_UPLOAD: 'E_STORAGE_UPLOAD',
  STORAGE_DELETE: 'E_STORAGE_DELETE',
  NETWORK: 'E_NETWORK',
} as const;
