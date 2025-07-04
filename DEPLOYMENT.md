# Quick Deployment Guide

## GitHub Setup (via Cursor)

1. **Download project as ZIP from Replit**
2. **Extract and open in Cursor**
3. **Initialize Git repository:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Video Generator API"
   ```
4. **Create GitHub repository and push:**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/video-generator.git
   git branch -M main
   git push -u origin main
   ```

## DigitalOcean Deployment

### Create Droplet
- **Image**: Ubuntu 22.04 LTS
- **Size**: 2GB RAM ($12/month) or 4GB RAM ($24/month)  
- **Add SSH key**

### Deploy Application
```bash
# Connect to server
ssh root@YOUR_SERVER_IP

# Upload and run setup script
curl -O https://raw.githubusercontent.com/YOUR_USERNAME/video-generator/main/digitalocean-setup.sh
chmod +x digitalocean-setup.sh
./digitalocean-setup.sh

# Clone repository
cd /var/www/video-generator
git clone https://github.com/YOUR_USERNAME/video-generator.git .

# Deploy application
chmod +x deploy.sh
./deploy.sh

# Update domain in nginx config
nano /etc/nginx/sites-available/video-generator
# Replace YOUR_DOMAIN.com with your domain

# Reload nginx
nginx -t && systemctl reload nginx

# Set up SSL (optional)
certbot --nginx -d yourdomain.com
```

### Test Deployment
```bash
# Check application status
pm2 status
curl http://YOUR_SERVER_IP/api/stats

# Monitor logs
pm2 logs video-generator
```

## Key Benefits
- **No timeout limits** - Process 30-minute videos without interruption
- **Dedicated resources** - 2-4GB RAM exclusively for your app
- **Cost effective** - $12-24/month vs $20/month Replit Pro
- **Full control** - Root access for custom optimizations

Your video generator will run reliably on DigitalOcean with unlimited processing time.