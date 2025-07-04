# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install system dependencies for building
RUN apk add --no-cache python3 make g++ && \
    ln -sf python3 /usr/bin/python

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY components.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY client ./client
COPY server ./server
COPY shared ./shared

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install system dependencies
RUN apk add --no-cache \
    ffmpeg \
    ca-certificates \
    tzdata \
    && rm -rf /var/cache/apk/*

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S videoapp -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY package-production.json ./

# Install production dependencies only
RUN npm ci --only=production --ignore-scripts && \
    npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --chown=videoapp:nodejs --from=builder /app/server ./server
COPY --chown=videoapp:nodejs --from=builder /app/shared ./shared

# Create required directories
RUN mkdir -p temp output logs && \
    chown -R videoapp:nodejs /app

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    TEMP_DIR=/app/temp \
    OUTPUT_DIR=/app/output

# Switch to non-root user
USER videoapp

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/stats', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => { process.exit(1); });"

# Start the application
CMD ["node", "dist/index.js"] 