import fs from 'fs';
import path from 'path';

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

// Log interface
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  requestId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  duration?: number;
  error?: Error;
}

// Logger configuration
const LOG_CONFIG = {
  level: process.env.LOG_LEVEL ? parseInt(process.env.LOG_LEVEL) : LogLevel.INFO,
  directory: process.env.LOG_DIRECTORY || './logs',
  maxFileSize: parseInt(process.env.LOG_MAX_FILE_SIZE || '10485760'), // 10MB
  maxFiles: parseInt(process.env.LOG_MAX_FILES || '10'),
  console: process.env.LOG_CONSOLE !== 'false',
  json: process.env.LOG_JSON === 'true',
};

// Log file streams
const logStreams = new Map<string, fs.WriteStream>();

// Initialize log directory
function initializeLogDirectory() {
  if (!fs.existsSync(LOG_CONFIG.directory)) {
    fs.mkdirSync(LOG_CONFIG.directory, { recursive: true });
  }
}

// Get log file path
function getLogFilePath(type: string): string {
  const date = new Date().toISOString().split('T')[0];
  return path.join(LOG_CONFIG.directory, `${type}_${date}.log`);
}

// Get or create log stream
function getLogStream(type: string): fs.WriteStream {
  const filePath = getLogFilePath(type);
  
  if (!logStreams.has(filePath)) {
    const stream = fs.createWriteStream(filePath, { flags: 'a' });
    logStreams.set(filePath, stream);
    
    // Rotate log file if it gets too large
    fs.stat(filePath, (err, stats) => {
      if (!err && stats.size > LOG_CONFIG.maxFileSize) {
        rotateLogFile(filePath, type);
      }
    });
  }
  
  return logStreams.get(filePath)!;
}

// Rotate log file
function rotateLogFile(filePath: string, type: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rotatedPath = filePath.replace('.log', `_${timestamp}.log`);
  
  fs.rename(filePath, rotatedPath, (err) => {
    if (err) {
      console.error('Failed to rotate log file:', err);
    } else {
      // Close old stream and remove from map
      const stream = logStreams.get(filePath);
      if (stream) {
        stream.end();
        logStreams.delete(filePath);
      }
      
      // Clean up old log files
      cleanupOldLogs(type);
    }
  });
}

// Clean up old log files
function cleanupOldLogs(type: string) {
  fs.readdir(LOG_CONFIG.directory, (err, files) => {
    if (err) return;
    
    const typeFiles = files
      .filter(file => file.startsWith(`${type}_`) && file.endsWith('.log'))
      .map(file => ({
        name: file,
        path: path.join(LOG_CONFIG.directory, file),
        time: fs.statSync(path.join(LOG_CONFIG.directory, file)).mtime
      }))
      .sort((a, b) => b.time.getTime() - a.time.getTime());
    
    // Delete files beyond max count
    if (typeFiles.length > LOG_CONFIG.maxFiles) {
      const filesToDelete = typeFiles.slice(LOG_CONFIG.maxFiles);
      filesToDelete.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Failed to delete old log file:', err);
        });
      });
    }
  });
}

// Format log entry
function formatLogEntry(entry: LogEntry): string {
  if (LOG_CONFIG.json) {
    return JSON.stringify(entry);
  }
  
  const level = LogLevel[entry.level];
  const timestamp = entry.timestamp;
  const message = entry.message;
  const data = entry.data ? ` | ${JSON.stringify(entry.data)}` : '';
  const requestId = entry.requestId ? ` | Request: ${entry.requestId}` : '';
  const duration = entry.duration ? ` | Duration: ${entry.duration}ms` : '';
  const error = entry.error ? ` | Error: ${entry.error.message}` : '';
  
  return `${timestamp} [${level}] ${message}${data}${requestId}${duration}${error}`;
}

// Write log entry
function writeLogEntry(entry: LogEntry, type: string = 'app') {
  if (entry.level < LOG_CONFIG.level) return;
  
  const formattedEntry = formatLogEntry(entry);
  
  // Write to console
  if (LOG_CONFIG.console) {
    const consoleMethod = entry.level >= LogLevel.ERROR ? 'error' : 
                         entry.level >= LogLevel.WARN ? 'warn' : 'log';
    console[consoleMethod](formattedEntry);
  }
  
  // Write to file
  try {
    const stream = getLogStream(type);
    stream.write(formattedEntry + '\n');
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}

// Logger class
export class Logger {
  private context: string;
  private requestId?: string;
  private userId?: string;
  private ip?: string;
  private userAgent?: string;
  
  constructor(context: string = 'App') {
    this.context = context;
  }
  
  setRequestContext(requestId?: string, userId?: string, ip?: string, userAgent?: string) {
    this.requestId = requestId;
    this.userId = userId;
    this.ip = ip;
    this.userAgent = userAgent;
  }
  
  private createLogEntry(level: LogLevel, message: string, data?: any, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message: `[${this.context}] ${message}`,
      data,
      requestId: this.requestId,
      userId: this.userId,
      ip: this.ip,
      userAgent: this.userAgent,
      error
    };
  }
  
  debug(message: string, data?: any) {
    const entry = this.createLogEntry(LogLevel.DEBUG, message, data);
    writeLogEntry(entry, 'debug');
  }
  
  info(message: string, data?: any) {
    const entry = this.createLogEntry(LogLevel.INFO, message, data);
    writeLogEntry(entry, 'info');
  }
  
  warn(message: string, data?: any) {
    const entry = this.createLogEntry(LogLevel.WARN, message, data);
    writeLogEntry(entry, 'warn');
  }
  
  error(message: string, error?: Error, data?: any) {
    const entry = this.createLogEntry(LogLevel.ERROR, message, data, error);
    writeLogEntry(entry, 'error');
  }
  
  fatal(message: string, error?: Error, data?: any) {
    const entry = this.createLogEntry(LogLevel.FATAL, message, data, error);
    writeLogEntry(entry, 'error');
  }
  
  // Performance logging
  time(label: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      const entry = this.createLogEntry(LogLevel.INFO, `Performance: ${label}`, undefined);
      entry.duration = duration;
      writeLogEntry(entry, 'performance');
    };
  }
  
  // HTTP request logging
  logRequest(method: string, url: string, statusCode: number, duration: number, data?: any) {
    const entry = this.createLogEntry(
      LogLevel.INFO,
      `${method} ${url} ${statusCode}`,
      data
    );
    entry.duration = duration;
    writeLogEntry(entry, 'access');
  }
  
  // Video processing logging
  logVideoProcessing(jobId: string, stage: string, duration?: number, data?: any) {
    const entry = this.createLogEntry(
      LogLevel.INFO,
      `Video Processing [${jobId}] ${stage}`,
      data
    );
    if (duration) entry.duration = duration;
    writeLogEntry(entry, 'video');
  }
  
  // Security logging
  logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high', data?: any) {
    const level = severity === 'high' ? LogLevel.ERROR : 
                  severity === 'medium' ? LogLevel.WARN : LogLevel.INFO;
    const entry = this.createLogEntry(level, `Security: ${event}`, data);
    writeLogEntry(entry, 'security');
  }
}

// Global logger instance
export const logger = new Logger();

// Request logging middleware
export function requestLogger(req: any, res: any, next: any) {
  const startTime = Date.now();
  const requestId = generateRequestId();
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  
  // Set request context
  req.requestId = requestId;
  logger.setRequestContext(requestId, undefined, ip, userAgent);
  
  // Log request start
  logger.info(`Request started: ${req.method} ${req.originalUrl}`, {
    method: req.method,
    url: req.originalUrl,
    ip,
    userAgent,
    requestId
  });
  
  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.logRequest(req.method, req.originalUrl, res.statusCode, duration, {
      requestId,
      responseSize: res.get('content-length') || 0
    });
  });
  
  next();
}

// Generate request ID
function generateRequestId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Performance monitoring
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  
  record(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // Keep only last 100 values
    if (values.length > 100) {
      values.shift();
    }
  }
  
  getStats(name: string) {
    const values = this.metrics.get(name) || [];
    if (values.length === 0) return null;
    
    const sorted = [...values].sort((a, b) => a - b);
    return {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }
  
  getAllStats() {
    const stats: any = {};
    for (const [name] of this.metrics) {
      stats[name] = this.getStats(name);
    }
    return stats;
  }
}

// Global performance monitor
export const performanceMonitor = new PerformanceMonitor();

// Initialize logging
initializeLogDirectory();

// Periodic cleanup
setInterval(() => {
  // Clean up old log streams
  const now = Date.now();
  for (const [filePath, stream] of logStreams.entries()) {
    try {
      const stats = fs.statSync(filePath);
      if (now - stats.mtime.getTime() > 24 * 60 * 60 * 1000) { // 24 hours
        stream.end();
        logStreams.delete(filePath);
      }
    } catch (error) {
      // File might not exist anymore
      stream.end();
      logStreams.delete(filePath);
    }
  }
}, 60 * 60 * 1000); // Clean up every hour

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, closing log streams...');
  for (const stream of logStreams.values()) {
    stream.end();
  }
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, closing log streams...');
  for (const stream of logStreams.values()) {
    stream.end();
  }
}); 