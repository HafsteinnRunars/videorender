#!/bin/bash

# Complete DigitalOcean Deployment Script
# Run this after basic setup to deploy the application

set -e

echo "🚀 Deploying Video Generator Application..."

# Navigate to app directory
cd /var/www/video-generator

# Install production dependencies only
echo "📦 Installing production dependencies..."
npm ci --only=production

# Create required directories
echo "📁 Creating required directories..."
mkdir -p temp output logs
chmod 755 temp output logs

# Set proper ownership
echo "🔒 Setting permissions..."
chown -R www-data:www-data /var/www/video-generator
chmod -R 755 /var/www/video-generator

# Copy production package.json if needed
if [ -f "package-production.json" ]; then
    echo "📄 Using production package.json..."
    cp package-production.json package.json
fi

# Start application with PM2
echo "⚙️ Starting application with PM2..."
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

# Configure Nginx
echo "🌐 Configuring Nginx..."
if [ -f "nginx.conf" ]; then
    cp nginx.conf /etc/nginx/sites-available/video-generator
    ln -sf /etc/nginx/sites-available/video-generator /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    echo "⚠️ Please update domain in /etc/nginx/sites-available/video-generator"
    echo "Replace YOUR_DOMAIN.com with your actual domain"
fi

# Test Nginx configuration
nginx -t && systemctl restart nginx

# Configure firewall
echo "🔥 Configuring firewall..."
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'

# Display status
echo "✅ Deployment complete!"
echo ""
echo "📊 Application Status:"
pm2 status
echo ""
echo "🌐 Nginx Status:"
systemctl status nginx --no-pager -l
echo ""
echo "📋 Next Steps:"
echo "1. Update domain in /etc/nginx/sites-available/video-generator"
echo "2. Run: sudo nginx -t && sudo systemctl reload nginx"
echo "3. Set up SSL: sudo certbot --nginx -d yourdomain.com"
echo "4. Test API: curl http://yourdomain.com/api/stats"