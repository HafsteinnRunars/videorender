import { z } from 'zod';

// Environment validation schema
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  
  // Application config
  APP_NAME: z.string().default('VideoMaestro'),
  APP_VERSION: z.string().default('1.0.0'),
  
  // Domain and URLs
  DOMAIN: z.string().optional(),
  BASE_URL: z.string().url().optional(),
  
  // Security
  SESSION_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().optional(),
  TRUSTED_PROXIES: z.string().optional(),
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(5),
  
  // Video processing
  MAX_CONCURRENT_JOBS: z.coerce.number().default(3),
  VIDEO_DURATION_SECONDS: z.coerce.number().default(1800),
  FFMPEG_THREADS: z.coerce.number().default(0),
  CLEANUP_TEMP_FILES: z.coerce.boolean().default(true),
  
  // File storage
  TEMP_DIR: z.string().default('./temp'),
  OUTPUT_DIR: z.string().default('./output'),
  MAX_FILE_SIZE: z.string().default('500MB'),
  
  // Database (optional)
  DATABASE_URL: z.string().url().optional(),
  DATABASE_SSL: z.coerce.boolean().default(false),
  
  // Redis (optional)
  REDIS_URL: z.string().url().optional(),
  
  // Monitoring (optional)
  SENTRY_DSN: z.string().url().optional(),
  MONITORING_ENABLED: z.coerce.boolean().default(false),
  
  // AWS S3 (optional)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_BUCKET_NAME: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  
  // Email (optional)
  EMAIL_SERVICE: z.string().optional(),
  EMAIL_USER: z.string().email().optional(),
  EMAIL_PASS: z.string().optional(),
  
  // Webhooks (optional)
  WEBHOOK_URL: z.string().url().optional(),
  
  // SSL/TLS
  SSL_KEY_PATH: z.string().optional(),
  SSL_CERT_PATH: z.string().optional(),
});

// Validate and export environment variables
function validateEnvironment() {
  try {
    const env = envSchema.parse(process.env);
    return env;
  } catch (error) {
    console.error('Environment validation failed:');
    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
    }
    process.exit(1);
  }
}

export const config = validateEnvironment();

// Helper functions
export function isProduction(): boolean {
  return config.NODE_ENV === 'production';
}

export function isDevelopment(): boolean {
  return config.NODE_ENV === 'development';
}

export function isTest(): boolean {
  return config.NODE_ENV === 'test';
}

export function getBaseUrl(): string {
  if (config.BASE_URL) {
    return config.BASE_URL;
  }
  
  const protocol = isProduction() ? 'https' : 'http';
  const host = config.DOMAIN || 'localhost';
  const port = config.PORT !== 80 && config.PORT !== 443 ? `:${config.PORT}` : '';
  
  return `${protocol}://${host}${port}`;
}

export function getCorsOrigins(): string[] {
  if (!config.CORS_ORIGIN) {
    return isDevelopment() ? ['http://localhost:5173'] : [];
  }
  
  return config.CORS_ORIGIN.split(',').map(origin => origin.trim());
}

export function getTrustedProxies(): string[] {
  if (!config.TRUSTED_PROXIES) {
    return [];
  }
  
  return config.TRUSTED_PROXIES.split(',').map(proxy => proxy.trim());
}

// Validation helpers
export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Security helpers
export function generateSecureToken(length: number = 32): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

export function maskSensitiveData(data: any): any {
  const sensitiveKeys = ['password', 'secret', 'token', 'key', 'auth'];
  
  if (typeof data === 'object' && data !== null) {
    const masked = { ...data };
    
    for (const key in masked) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        masked[key] = '***MASKED***';
      } else if (typeof masked[key] === 'object') {
        masked[key] = maskSensitiveData(masked[key]);
      }
    }
    
    return masked;
  }
  
  return data;
}

// Log configuration (with sensitive data masked)
console.log('Configuration loaded:', maskSensitiveData(config)); 