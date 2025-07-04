#!/bin/bash

# DigitalOcean Droplet Setup Script for VideoMaestro
# Run this script on a fresh Ubuntu 22.04 droplet
# Usage: curl -fsSL https://raw.githubusercontent.com/yourusername/videomaestro/main/digitalocean-setup.sh | sudo bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
    exit 1
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   error "This script must be run as root (use sudo)"
fi

log "🚀 Setting up VideoMaestro on DigitalOcean..."

# System information
log "📋 System Information:"
echo "   OS: $(lsb_release -d | cut -f2)"
echo "   Kernel: $(uname -r)"
echo "   Memory: $(free -h | grep Mem | awk '{print $2}')"
echo "   Disk: $(df -h / | tail -1 | awk '{print $2}')"

# Update system
log "📦 Updating system packages..."
apt update && apt upgrade -y

# Install essential packages
log "🔧 Installing essential packages..."
apt install -y curl wget unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release

# Install Node.js 20
log "📥 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify Node.js installation
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
log "✅ Node.js installed: $NODE_VERSION"
log "✅ npm installed: $NPM_VERSION"

# Install FFmpeg (essential for video processing)
log "🎬 Installing FFmpeg..."
apt install -y ffmpeg
FFMPEG_VERSION=$(ffmpeg -version | head -n1 | grep -o 'ffmpeg version [0-9.]*' | grep -o '[0-9.]*')
log "✅ FFmpeg installed: $FFMPEG_VERSION"

# Install PM2 for process management
log "⚙️ Installing PM2..."
npm install -g pm2@latest
pm2 startup systemd --user=www-data --hp=/var/www

# Install Nginx for reverse proxy
log "🌐 Installing Nginx..."
apt install -y nginx

# Install additional utilities
log "🛠️ Installing additional utilities..."
apt install -y git htop iotop ufw fail2ban logrotate

# Configure firewall
log "🔥 Configuring firewall..."
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 'Nginx Full'

# Configure fail2ban
log "🛡️ Configuring fail2ban..."
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 3

[nginx-noscript]
enabled = true
port = http,https
filter = nginx-noscript
logpath = /var/log/nginx/access.log
maxretry = 6
EOF

systemctl restart fail2ban
systemctl enable fail2ban

# Create application user and directories
log "👤 Creating application user and directories..."
useradd -r -s /bin/bash -d /var/www/videomaestro -m videomaestro || true
mkdir -p /var/www/videomaestro/{temp,output,logs}
chown -R videomaestro:videomaestro /var/www/videomaestro
chmod -R 755 /var/www/videomaestro

# Set up log rotation
log "📝 Setting up log rotation..."
cat > /etc/logrotate.d/videomaestro << 'EOF'
/var/www/videomaestro/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 videomaestro videomaestro
    postrotate
        /usr/bin/pm2 reloadLogs
    endscript
}
EOF

# Create systemd service for PM2
log "⚙️ Creating systemd service for PM2..."
cat > /etc/systemd/system/videomaestro.service << 'EOF'
[Unit]
Description=VideoMaestro Application
After=network.target

[Service]
Type=forking
User=videomaestro
WorkingDirectory=/var/www/videomaestro
ExecStart=/usr/bin/pm2 start ecosystem.config.js --env production
ExecStop=/usr/bin/pm2 stop all
ExecReload=/usr/bin/pm2 reload all
Restart=always
RestartSec=10
KillMode=process

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable videomaestro

# Install Docker (optional for containerized deployment)
log "🐳 Installing Docker..."
curl -fsSL https://get.docker.com | sh
usermod -aG docker videomaestro

# Install Docker Compose
log "🐙 Installing Docker Compose..."
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create deployment directory
log "📁 Creating deployment directory..."
mkdir -p /opt/videomaestro-deploy
cat > /opt/videomaestro-deploy/deploy.sh << 'EOF'
#!/bin/bash
# Quick deployment script
set -e

REPO_URL="https://github.com/yourusername/videomaestro.git"
DEPLOY_DIR="/var/www/videomaestro"
BACKUP_DIR="/var/backups/videomaestro"

# Create backup
mkdir -p $BACKUP_DIR
rsync -av --exclude='node_modules' --exclude='temp' --exclude='output' $DEPLOY_DIR/ $BACKUP_DIR/$(date +%Y%m%d_%H%M%S)/

# Deploy
cd $DEPLOY_DIR
git pull origin main
npm ci --only=production
pm2 reload ecosystem.config.js --env production

echo "✅ Deployment complete!"
EOF

chmod +x /opt/videomaestro-deploy/deploy.sh

# Create monitoring script
log "📊 Creating monitoring script..."
cat > /opt/videomaestro-deploy/monitor.sh << 'EOF'
#!/bin/bash
# System monitoring script

echo "=== VideoMaestro System Status ==="
echo "Time: $(date)"
echo "Uptime: $(uptime)"
echo ""

echo "=== Memory Usage ==="
free -h
echo ""

echo "=== Disk Usage ==="
df -h
echo ""

echo "=== PM2 Status ==="
pm2 status
echo ""

echo "=== Nginx Status ==="
systemctl status nginx --no-pager -l
echo ""

echo "=== Active Connections ==="
netstat -an | grep :80 | wc -l
echo ""

echo "=== Recent Logs ==="
journalctl -u videomaestro -n 10 --no-pager
EOF

chmod +x /opt/videomaestro-deploy/monitor.sh

# Create maintenance script
log "🔧 Creating maintenance script..."
cat > /opt/videomaestro-deploy/maintenance.sh << 'EOF'
#!/bin/bash
# Maintenance script

echo "=== VideoMaestro Maintenance ==="

# Clean up old logs
find /var/www/videomaestro/logs -name "*.log" -type f -mtime +7 -delete
find /var/www/videomaestro/temp -name "*" -type f -mtime +1 -delete

# Clean up old backups
find /var/backups/videomaestro -type d -mtime +30 -exec rm -rf {} +

# Update system packages
apt update && apt upgrade -y

# Restart services
systemctl restart nginx
pm2 restart all

# Check disk space
df -h | awk '$5 > 80 { print "WARNING: "$0 }'

echo "✅ Maintenance complete!"
EOF

chmod +x /opt/videomaestro-deploy/maintenance.sh

# Set up cron jobs
log "⏰ Setting up cron jobs..."
cat > /etc/cron.d/videomaestro << 'EOF'
# VideoMaestro maintenance jobs
0 2 * * * root /opt/videomaestro-deploy/maintenance.sh >> /var/log/videomaestro-maintenance.log 2>&1
*/5 * * * * root /opt/videomaestro-deploy/monitor.sh >> /var/log/videomaestro-monitor.log 2>&1
EOF

log "✅ Setup complete!"
log "📋 Next steps:"
echo "   1. Clone your repository:"
echo "      cd /var/www/videomaestro"
echo "      sudo -u videomaestro git clone https://github.com/yourusername/videomaestro.git ."
echo ""
echo "   2. Configure environment variables:"
echo "      sudo -u videomaestro cp env.example .env"
echo "      sudo -u videomaestro nano .env"
echo ""
echo "   3. Install dependencies and start:"
echo "      sudo -u videomaestro npm install"
echo "      sudo systemctl start videomaestro"
echo ""
echo "   4. Configure Nginx:"
echo "      sudo cp nginx.conf /etc/nginx/sites-available/videomaestro"
echo "      sudo ln -s /etc/nginx/sites-available/videomaestro /etc/nginx/sites-enabled/"
echo "      sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "   5. Set up SSL (optional):"
echo "      sudo apt install certbot python3-certbot-nginx"
echo "      sudo certbot --nginx -d yourdomain.com"
echo ""
echo "📊 Management Commands:"
echo "   - Monitor: /opt/videomaestro-deploy/monitor.sh"
echo "   - Deploy: /opt/videomaestro-deploy/deploy.sh"
echo "   - Maintenance: /opt/videomaestro-deploy/maintenance.sh"
echo ""
echo "🔗 Access your application:"
echo "   - HTTP: http://$(curl -s ifconfig.me)"
echo "   - HTTPS: https://yourdomain.com (after SSL setup)"