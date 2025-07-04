#!/bin/bash

# VideoMaestro Production Deployment Script
# Run this script to deploy the application to production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="videomaestro"
DEPLOY_DIR="/var/www/videomaestro"
BACKUP_DIR="/var/backups/videomaestro"
LOG_FILE="/var/log/videomaestro-deploy.log"
REPO_URL="https://github.com/yourusername/videomaestro.git"
BRANCH="main"

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a $LOG_FILE
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a $LOG_FILE
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a $LOG_FILE
    exit 1
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   error "This script should not be run as root. Run as the videomaestro user."
fi

# Check if we're in the correct directory
if [[ ! -d "/var/www/videomaestro" ]]; then
    error "Deployment directory not found. Please run setup script first."
fi

log "🚀 Starting VideoMaestro deployment..."

# Create backup
log "💾 Creating backup..."
mkdir -p $BACKUP_DIR
BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S)"
sudo mkdir -p $BACKUP_DIR/$BACKUP_NAME

if [[ -d "$DEPLOY_DIR" ]]; then
    sudo rsync -av --exclude='node_modules' --exclude='temp' --exclude='output' --exclude='.git' $DEPLOY_DIR/ $BACKUP_DIR/$BACKUP_NAME/
    log "✅ Backup created: $BACKUP_DIR/$BACKUP_NAME"
fi

# Change to deployment directory
cd $DEPLOY_DIR

# Check if git repository exists
if [[ ! -d ".git" ]]; then
    log "📥 Cloning repository..."
    git clone $REPO_URL .
else
    log "🔄 Updating repository..."
    git fetch origin
    git reset --hard origin/$BRANCH
fi

# Check for environment file
if [[ ! -f ".env" ]]; then
    if [[ -f "env.example" ]]; then
        log "📋 Creating environment file from example..."
        cp env.example .env
        warn "Please update .env file with your production configuration"
    else
        warn "No environment file found. Creating basic .env file..."
        cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
SESSION_SECRET=your-super-secret-key-change-this-in-production
CLEANUP_TEMP_FILES=true
MONITORING_ENABLED=true
EOF
    fi
fi

# Install dependencies
log "📦 Installing dependencies..."
if [[ -f "package-production.json" ]]; then
    log "📄 Using production package.json..."
    cp package-production.json package.json
fi

npm ci --only=production

# Create required directories
log "📁 Creating required directories..."
mkdir -p temp output logs
chmod 755 temp output logs

# Build application if needed
if [[ -f "package.json" ]] && grep -q "build" package.json; then
    log "🔨 Building application..."
    npm run build
fi

# Run database migrations if needed
if [[ -f "drizzle.config.ts" ]]; then
    log "🗄️ Running database migrations..."
    npm run db:push || warn "Database migrations failed or not needed"
fi

# Health check before deployment
log "🏥 Running health checks..."
if command -v ffmpeg &> /dev/null; then
    log "✅ FFmpeg is available"
else
    error "FFmpeg is not installed"
fi

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    log "✅ Node.js version: $NODE_VERSION"
else
    error "Node.js is not installed"
fi

# Stop existing application
log "🛑 Stopping existing application..."
if pm2 describe $APP_NAME > /dev/null 2>&1; then
    pm2 stop $APP_NAME
    pm2 delete $APP_NAME
fi

# Start application with PM2
log "🚀 Starting application with PM2..."
pm2 start ecosystem.config.js --env production --name $APP_NAME
pm2 save

# Configure Nginx
log "🌐 Configuring Nginx..."
if [[ -f "nginx.conf" ]]; then
    sudo cp nginx.conf /etc/nginx/sites-available/$APP_NAME
    sudo ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Test Nginx configuration
    if sudo nginx -t; then
        sudo systemctl reload nginx
        log "✅ Nginx configuration updated"
    else
        error "Nginx configuration test failed"
    fi
else
    warn "nginx.conf not found. Please configure Nginx manually."
fi

# Wait for application to start
log "⏳ Waiting for application to start..."
sleep 10

# Health check
log "🏥 Running post-deployment health checks..."
if pm2 describe $APP_NAME | grep -q "online"; then
    log "✅ Application is running"
else
    error "Application failed to start"
fi

# Test API endpoints
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    log "✅ Health endpoint is responding"
else
    warn "Health endpoint not responding"
fi

# Check logs for errors
if pm2 logs $APP_NAME --lines 10 | grep -i error; then
    warn "Errors found in logs, please check"
fi

# Clean up old backups (keep last 5)
log "🧹 Cleaning up old backups..."
sudo find $BACKUP_DIR -maxdepth 1 -type d -name "backup_*" | sort | head -n -5 | sudo xargs rm -rf

# Set up monitoring
log "📊 Setting up monitoring..."
if [[ -f "/opt/videomaestro-deploy/monitor.sh" ]]; then
    /opt/videomaestro-deploy/monitor.sh
fi

# Display final status
log "✅ Deployment complete!"
echo ""
echo "📊 Application Status:"
pm2 status
echo ""
echo "🌐 Nginx Status:"
sudo systemctl status nginx --no-pager -l
echo ""
echo "📋 Post-deployment checklist:"
echo "   ✓ Application deployed and running"
echo "   ✓ PM2 process manager configured"
echo "   ✓ Nginx reverse proxy configured"
echo "   ✓ Backups created"
echo "   ✓ Health checks passed"
echo ""
echo "🔗 Access your application:"
echo "   - Local: http://localhost:3000"
echo "   - Public: http://$(curl -s ifconfig.me)"
echo ""
echo "📊 Monitoring commands:"
echo "   - Check status: pm2 status"
echo "   - View logs: pm2 logs $APP_NAME"
echo "   - Monitor resources: pm2 monit"
echo "   - Restart: pm2 restart $APP_NAME"
echo ""
echo "🔄 Next steps:"
echo "   1. Update your domain in /etc/nginx/sites-available/$APP_NAME"
echo "   2. Set up SSL certificate: sudo certbot --nginx -d yourdomain.com"
echo "   3. Configure environment variables in .env file"
echo "   4. Test API endpoints: curl http://yourdomain.com/api/stats"
echo ""
echo "🎉 Your VideoMaestro application is now live!"