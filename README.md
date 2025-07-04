# Video Generator API

A Node.js video generator application that creates 30-minute 1080p MP4 videos from thumbnails and 10-song playlists using FFmpeg.

## Features

- **Synchronous Processing**: Direct video URL response without polling
- **30-minute Videos**: Loops 10 songs seamlessly for exactly 30 minutes
- **High Performance**: Ultra-fast FFmpeg encoding optimizations
- **Modern Stack**: React frontend with Express backend
- **Real-time Dashboard**: Monitor jobs and processing status

## Quick Start

### Local Development

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/video-generator.git
cd video-generator

# Install dependencies
npm install

# Start development server
npm run dev
```

### DigitalOcean Deployment

1. **Create Droplet**
   - Ubuntu 22.04 LTS
   - 2GB RAM minimum (4GB recommended)
   - Enable monitoring

2. **Run Setup Script**
   ```bash
   # Upload and run setup script
   scp digitalocean-setup.sh root@YOUR_SERVER_IP:~/
   ssh root@YOUR_SERVER_IP
   chmod +x digitalocean-setup.sh
   ./digitalocean-setup.sh
   ```

3. **Deploy Application**
   ```bash
   # Clone repository
   cd /var/www/video-generator
   git clone https://github.com/YOUR_USERNAME/video-generator.git .
   
   # Install dependencies
   npm install
   
   # Create logs directory
   mkdir logs
   
   # Start with PM2
   pm2 start ecosystem.config.js --env production
   pm2 save
   pm2 startup
   ```

4. **Configure Nginx**
   ```bash
   # Copy nginx config
   cp nginx.conf /etc/nginx/sites-available/video-generator
   ln -s /etc/nginx/sites-available/video-generator /etc/nginx/sites-enabled/
   rm /etc/nginx/sites-enabled/default
   
   # Update domain in config
   nano /etc/nginx/sites-available/video-generator
   
   # Test and restart
   nginx -t
   systemctl restart nginx
   ```

5. **SSL Certificate**
   ```bash
   apt install certbot python3-certbot-nginx
   certbot --nginx -d yourdomain.com
   ```

## API Usage

### Create Video

```bash
POST /api/video-jobs
Content-Type: application/json

{
  "title": "My Video",
  "thumbnail_url": "https://example.com/thumbnail.jpg",
  "songs": [
    {"title": "Song 1", "url": "https://example.com/song1.mp3"},
    {"title": "Song 2", "url": "https://example.com/song2.mp3"},
    // ... 10 songs total
  ]
}
```

### Response

```json
{
  "job_id": "uuid",
  "status": "completed",
  "video_url": "https://yourdomain.com/output/video.mp4",
  "message": "Video processing completed successfully"
}
```

## System Requirements

### Development
- Node.js 18+
- FFmpeg installed
- 4GB RAM minimum

### Production
- Ubuntu 22.04 LTS
- 2+ CPU cores
- 4GB+ RAM
- 20GB+ storage
- FFmpeg 4.4+

## Environment Variables

```bash
NODE_ENV=production
PORT=3000
# Add database URL if using PostgreSQL
```

## Monitoring

```bash
# PM2 status
pm2 status
pm2 logs video-generator

# System resources
htop
df -h

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## Performance Optimization

- **Ultra-fast FFmpeg preset** for speed
- **CRF 35** for balanced quality/speed
- **Mono audio** to reduce processing time
- **0.5fps thumbnail** for efficiency

## Cost Estimation

### DigitalOcean Droplet (2GB RAM)
- **Monthly**: $12/month
- **Processing**: ~1-2 minutes per 30-minute video
- **Concurrent**: 1-2 videos simultaneously

## Troubleshooting

### Common Issues

1. **FFmpeg not found**
   ```bash
   sudo apt install ffmpeg
   ```

2. **Permission errors**
   ```bash
   chown -R www-data:www-data /var/www/video-generator
   ```

3. **Out of memory**
   - Increase droplet RAM
   - Monitor with `htop`

4. **Nginx 413 error**
   - Increase `client_max_body_size` in nginx.conf

## License

MIT License - see LICENSE file for details.