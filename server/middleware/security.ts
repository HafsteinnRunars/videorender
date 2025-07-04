import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Rate limiting store
const rateLimitStore = new Map<string, { requests: number; resetTime: number }>();

// Security configuration
const SECURITY_CONFIG = {
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '5'),
  MAX_PAYLOAD_SIZE: process.env.MAX_PAYLOAD_SIZE || '10mb',
  CORS_ORIGINS: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
  TRUSTED_PROXIES: process.env.TRUSTED_PROXIES?.split(',') || [],
};

// Get client IP address
function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'] as string;
  const real = req.headers['x-real-ip'] as string;
  const cloudflare = req.headers['cf-connecting-ip'] as string;
  
  if (cloudflare) return cloudflare;
  if (real) return real;
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
}

// Rate limiting middleware
export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const clientIP = getClientIP(req);
  const now = Date.now();
  const windowStart = now - SECURITY_CONFIG.RATE_LIMIT_WINDOW;
  
  // Clean up old entries
  for (const [ip, data] of rateLimitStore.entries()) {
    if (data.resetTime < windowStart) {
      rateLimitStore.delete(ip);
    }
  }
  
  // Get or create rate limit data for this IP
  let rateLimitData = rateLimitStore.get(clientIP);
  if (!rateLimitData || rateLimitData.resetTime < windowStart) {
    rateLimitData = { requests: 0, resetTime: now + SECURITY_CONFIG.RATE_LIMIT_WINDOW };
    rateLimitStore.set(clientIP, rateLimitData);
  }
  
  rateLimitData.requests++;
  
  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', SECURITY_CONFIG.RATE_LIMIT_MAX);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, SECURITY_CONFIG.RATE_LIMIT_MAX - rateLimitData.requests));
  res.setHeader('X-RateLimit-Reset', new Date(rateLimitData.resetTime).toISOString());
  
  // Check if rate limit exceeded
  if (rateLimitData.requests > SECURITY_CONFIG.RATE_LIMIT_MAX) {
    console.warn(`Rate limit exceeded for IP: ${clientIP}`);
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil((rateLimitData.resetTime - now) / 1000)
    });
  }
  
  next();
}

// CORS middleware
export function corsHandler(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  
  // Allow requests from configured origins
  if (origin && SECURITY_CONFIG.CORS_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (process.env.NODE_ENV === 'development') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '3600');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
}

// Security headers middleware
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "media-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; ');
  
  res.setHeader('Content-Security-Policy', csp);
  
  // Remove server identification
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  next();
}

// Request validation middleware
export function validateRequest(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      if (req.body) {
        req.body = schema.parse(req.body);
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
}

// Request sanitization middleware
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  // Basic input sanitization
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  
  next();
}

// Sanitize object recursively
function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return obj.trim().replace(/[<>]/g, '');
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

// Error handling middleware
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error('Error:', err);
  
  // Log security-related errors
  if (err.message.includes('rate limit') || err.message.includes('validation')) {
    console.warn(`Security alert: ${err.message} from IP: ${getClientIP(req)}`);
  }
  
  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production') {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred'
    });
  }
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    stack: err.stack
  });
}

// Health check endpoint
export function healthCheck(req: Request, res: Response) {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  });
}

// Clean up rate limit store periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimitStore.entries()) {
    if (data.resetTime < now) {
      rateLimitStore.delete(ip);
    }
  }
}, 60000); // Clean up every minute 