import os from 'os';
import fs from 'fs';
import { logger, performanceMonitor } from './logger';

// System metrics interface
export interface SystemMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    used: number;
    free: number;
    total: number;
    usage: number;
  };
  disk: {
    used: number;
    free: number;
    total: number;
    usage: number;
  };
  network: {
    connections: number;
  };
  process: {
    pid: number;
    uptime: number;
    memory: NodeJS.MemoryUsage;
    cpu: number;
  };
}

// Application metrics interface
export interface ApplicationMetrics {
  timestamp: number;
  jobs: {
    total: number;
    active: number;
    completed: number;
    failed: number;
    queued: number;
  };
  requests: {
    total: number;
    ratePerMinute: number;
    errorRate: number;
    avgResponseTime: number;
  };
  videos: {
    totalProcessed: number;
    avgProcessingTime: number;
    totalFileSize: number;
    avgFileSize: number;
  };
  errors: {
    total: number;
    ratePerMinute: number;
    recentErrors: string[];
  };
}

// Monitoring configuration
const MONITORING_CONFIG = {
  enabled: process.env.MONITORING_ENABLED === 'true',
  interval: parseInt(process.env.MONITORING_INTERVAL || '60000'), // 60 seconds
  retentionDays: parseInt(process.env.MONITORING_RETENTION_DAYS || '7'),
  alertThresholds: {
    cpuUsage: parseFloat(process.env.ALERT_CPU_THRESHOLD || '80'),
    memoryUsage: parseFloat(process.env.ALERT_MEMORY_THRESHOLD || '85'),
    diskUsage: parseFloat(process.env.ALERT_DISK_THRESHOLD || '90'),
    errorRate: parseFloat(process.env.ALERT_ERROR_RATE || '5'),
    responseTime: parseInt(process.env.ALERT_RESPONSE_TIME || '5000'),
  }
};

// Metrics storage
const metrics = {
  system: [] as SystemMetrics[],
  application: [] as ApplicationMetrics[],
  requests: [] as any[],
  errors: [] as any[],
  videos: [] as any[]
};

// CPU usage tracking
let lastCpuUsage = process.cpuUsage();
let lastCpuTime = Date.now();

// Get CPU usage percentage
function getCpuUsage(): number {
  const currentUsage = process.cpuUsage();
  const currentTime = Date.now();
  
  const userDiff = currentUsage.user - lastCpuUsage.user;
  const systemDiff = currentUsage.system - lastCpuUsage.system;
  const timeDiff = currentTime - lastCpuTime;
  
  const cpuPercent = ((userDiff + systemDiff) / (timeDiff * 1000)) * 100;
  
  lastCpuUsage = currentUsage;
  lastCpuTime = currentTime;
  
  return Math.min(100, Math.max(0, cpuPercent));
}

// Get disk usage
function getDiskUsage(): { used: number; free: number; total: number; usage: number } {
  try {
    const stats = fs.statSync('.');
    const free = stats.size; // This is not accurate, but we'll use it as placeholder
    const total = os.totalmem(); // Approximation
    const used = total - free;
    const usage = (used / total) * 100;
    
    return { used, free, total, usage };
  } catch (error) {
    return { used: 0, free: 0, total: 0, usage: 0 };
  }
}

// Collect system metrics
function collectSystemMetrics(): SystemMetrics {
  const memoryUsage = process.memoryUsage();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  
  return {
    timestamp: Date.now(),
    cpu: {
      usage: getCpuUsage(),
      loadAverage: os.loadavg(),
      cores: os.cpus().length
    },
    memory: {
      used: usedMemory,
      free: freeMemory,
      total: totalMemory,
      usage: (usedMemory / totalMemory) * 100
    },
    disk: getDiskUsage(),
    network: {
      connections: 0 // Placeholder
    },
    process: {
      pid: process.pid,
      uptime: process.uptime(),
      memory: memoryUsage,
      cpu: getCpuUsage()
    }
  };
}

// Collect application metrics
function collectApplicationMetrics(): ApplicationMetrics {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  
  // Filter recent data
  const recentRequests = metrics.requests.filter(r => r.timestamp > oneMinuteAgo);
  const recentErrors = metrics.errors.filter(e => e.timestamp > oneMinuteAgo);
  
  // Calculate request metrics
  const totalRequests = metrics.requests.length;
  const requestsPerMinute = recentRequests.length;
  const errorRate = totalRequests > 0 ? (metrics.errors.length / totalRequests) * 100 : 0;
  const avgResponseTime = recentRequests.length > 0 ? 
    recentRequests.reduce((sum, r) => sum + r.duration, 0) / recentRequests.length : 0;
  
  // Calculate video metrics
  const totalVideos = metrics.videos.length;
  const avgProcessingTime = totalVideos > 0 ?
    metrics.videos.reduce((sum, v) => sum + v.processingTime, 0) / totalVideos : 0;
  const totalFileSize = metrics.videos.reduce((sum, v) => sum + (v.fileSize || 0), 0);
  const avgFileSize = totalVideos > 0 ? totalFileSize / totalVideos : 0;
  
  return {
    timestamp: now,
    jobs: {
      total: totalVideos,
      active: metrics.videos.filter(v => v.status === 'processing').length,
      completed: metrics.videos.filter(v => v.status === 'completed').length,
      failed: metrics.videos.filter(v => v.status === 'failed').length,
      queued: metrics.videos.filter(v => v.status === 'queued').length
    },
    requests: {
      total: totalRequests,
      ratePerMinute: requestsPerMinute,
      errorRate,
      avgResponseTime
    },
    videos: {
      totalProcessed: totalVideos,
      avgProcessingTime,
      totalFileSize,
      avgFileSize
    },
    errors: {
      total: metrics.errors.length,
      ratePerMinute: recentErrors.length,
      recentErrors: recentErrors.slice(-5).map(e => e.message)
    }
  };
}

// Check for alerts
function checkAlerts(systemMetrics: SystemMetrics, appMetrics: ApplicationMetrics) {
  const alerts = [];
  
  // CPU usage alert
  if (systemMetrics.cpu.usage > MONITORING_CONFIG.alertThresholds.cpuUsage) {
    alerts.push({
      type: 'cpu',
      severity: 'high',
      message: `High CPU usage: ${systemMetrics.cpu.usage.toFixed(1)}%`,
      threshold: MONITORING_CONFIG.alertThresholds.cpuUsage,
      value: systemMetrics.cpu.usage
    });
  }
  
  // Memory usage alert
  if (systemMetrics.memory.usage > MONITORING_CONFIG.alertThresholds.memoryUsage) {
    alerts.push({
      type: 'memory',
      severity: 'high',
      message: `High memory usage: ${systemMetrics.memory.usage.toFixed(1)}%`,
      threshold: MONITORING_CONFIG.alertThresholds.memoryUsage,
      value: systemMetrics.memory.usage
    });
  }
  
  // Disk usage alert
  if (systemMetrics.disk.usage > MONITORING_CONFIG.alertThresholds.diskUsage) {
    alerts.push({
      type: 'disk',
      severity: 'high',
      message: `High disk usage: ${systemMetrics.disk.usage.toFixed(1)}%`,
      threshold: MONITORING_CONFIG.alertThresholds.diskUsage,
      value: systemMetrics.disk.usage
    });
  }
  
  // Error rate alert
  if (appMetrics.requests.errorRate > MONITORING_CONFIG.alertThresholds.errorRate) {
    alerts.push({
      type: 'error_rate',
      severity: 'medium',
      message: `High error rate: ${appMetrics.requests.errorRate.toFixed(1)}%`,
      threshold: MONITORING_CONFIG.alertThresholds.errorRate,
      value: appMetrics.requests.errorRate
    });
  }
  
  // Response time alert
  if (appMetrics.requests.avgResponseTime > MONITORING_CONFIG.alertThresholds.responseTime) {
    alerts.push({
      type: 'response_time',
      severity: 'medium',
      message: `Slow response time: ${appMetrics.requests.avgResponseTime.toFixed(0)}ms`,
      threshold: MONITORING_CONFIG.alertThresholds.responseTime,
      value: appMetrics.requests.avgResponseTime
    });
  }
  
  // Log alerts
  alerts.forEach(alert => {
    logger.logSecurityEvent(
      `Alert: ${alert.message}`,
      alert.severity as 'low' | 'medium' | 'high',
      alert
    );
  });
  
  return alerts;
}

// Clean up old metrics
function cleanupMetrics() {
  const retentionTime = Date.now() - (MONITORING_CONFIG.retentionDays * 24 * 60 * 60 * 1000);
  
  metrics.system = metrics.system.filter(m => m.timestamp > retentionTime);
  metrics.application = metrics.application.filter(m => m.timestamp > retentionTime);
  metrics.requests = metrics.requests.filter(m => m.timestamp > retentionTime);
  metrics.errors = metrics.errors.filter(m => m.timestamp > retentionTime);
  metrics.videos = metrics.videos.filter(m => m.timestamp > retentionTime);
}

// Monitoring class
export class Monitor {
  private intervalId?: NodeJS.Timeout;
  
  start() {
    if (!MONITORING_CONFIG.enabled) {
      logger.info('Monitoring disabled');
      return;
    }
    
    logger.info('Starting monitoring system');
    
    this.intervalId = setInterval(() => {
      try {
        const systemMetrics = collectSystemMetrics();
        const appMetrics = collectApplicationMetrics();
        
        // Store metrics
        metrics.system.push(systemMetrics);
        metrics.application.push(appMetrics);
        
        // Check for alerts
        checkAlerts(systemMetrics, appMetrics);
        
        // Clean up old metrics
        cleanupMetrics();
        
        // Log summary
        logger.info('System health check', {
          cpu: `${systemMetrics.cpu.usage.toFixed(1)}%`,
          memory: `${systemMetrics.memory.usage.toFixed(1)}%`,
          uptime: `${Math.floor(systemMetrics.process.uptime / 60)}min`,
          activeJobs: appMetrics.jobs.active,
          requestsPerMinute: appMetrics.requests.ratePerMinute
        });
        
      } catch (error) {
        logger.error('Error collecting metrics', error);
      }
    }, MONITORING_CONFIG.interval);
  }
  
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info('Monitoring stopped');
    }
  }
  
  // Record request
  recordRequest(method: string, url: string, statusCode: number, duration: number) {
    metrics.requests.push({
      timestamp: Date.now(),
      method,
      url,
      statusCode,
      duration
    });
    
    performanceMonitor.record('request_duration', duration);
  }
  
  // Record error
  recordError(error: Error, context?: any) {
    metrics.errors.push({
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack,
      context
    });
  }
  
  // Record video processing
  recordVideoProcessing(jobId: string, status: string, processingTime?: number, fileSize?: number) {
    const existing = metrics.videos.find(v => v.jobId === jobId);
    if (existing) {
      existing.status = status;
      existing.timestamp = Date.now();
      if (processingTime) existing.processingTime = processingTime;
      if (fileSize) existing.fileSize = fileSize;
    } else {
      metrics.videos.push({
        timestamp: Date.now(),
        jobId,
        status,
        processingTime,
        fileSize
      });
    }
    
    if (processingTime) {
      performanceMonitor.record('video_processing_time', processingTime);
    }
  }
  
  // Get current metrics
  getMetrics() {
    return {
      system: metrics.system.slice(-1)[0] || null,
      application: metrics.application.slice(-1)[0] || null,
      performance: performanceMonitor.getAllStats()
    };
  }
  
  // Get health status
  getHealthStatus() {
    const systemMetrics = metrics.system.slice(-1)[0];
    const appMetrics = metrics.application.slice(-1)[0];
    
    if (!systemMetrics || !appMetrics) {
      return {
        status: 'unknown',
        message: 'No metrics available'
      };
    }
    
    const issues = [];
    
    if (systemMetrics.cpu.usage > MONITORING_CONFIG.alertThresholds.cpuUsage) {
      issues.push('High CPU usage');
    }
    
    if (systemMetrics.memory.usage > MONITORING_CONFIG.alertThresholds.memoryUsage) {
      issues.push('High memory usage');
    }
    
    if (appMetrics.requests.errorRate > MONITORING_CONFIG.alertThresholds.errorRate) {
      issues.push('High error rate');
    }
    
    const status = issues.length === 0 ? 'healthy' : 
                   issues.length <= 2 ? 'warning' : 'critical';
    
    return {
      status,
      message: issues.length === 0 ? 'System healthy' : `Issues: ${issues.join(', ')}`,
      issues,
      uptime: systemMetrics.process.uptime,
      timestamp: Date.now()
    };
  }
}

// Global monitor instance
export const monitor = new Monitor();

// Express middleware for monitoring
export function monitoringMiddleware(req: any, res: any, next: any) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    monitor.recordRequest(req.method, req.originalUrl, res.statusCode, duration);
  });
  
  next();
}

// Error monitoring middleware
export function errorMonitoringMiddleware(error: Error, req: any, res: any, next: any) {
  monitor.recordError(error, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.requestId
  });
  
  next(error);
}

// Start monitoring automatically
if (MONITORING_CONFIG.enabled) {
  monitor.start();
}

// Graceful shutdown
process.on('SIGTERM', () => {
  monitor.stop();
});

process.on('SIGINT', () => {
  monitor.stop();
}); 