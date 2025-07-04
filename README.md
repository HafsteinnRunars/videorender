# VideoMaestro - AI Video Generator

A high-performance Node.js application that generates 30-minute 1080p MP4 videos from thumbnails and 10-song playlists using FFmpeg optimization.

## 🚀 Features

- **Ultra-Fast Processing**: Optimized FFmpeg settings for 30-minute video generation
- **Full-Stack TypeScript**: React frontend with Express.js backend
- **Synchronous Processing**: Direct video URL response without polling complexity
- **Production Ready**: Configured for DigitalOcean deployment with PM2 and Nginx
- **Modern UI**: React 18 + Tailwind CSS with shadcn/ui components
- **Real-time Monitoring**: Dashboard with job status and statistics

## 📋 Technical Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Express.js, TypeScript, Drizzle ORM
- **Processing**: FFmpeg with ultra-fast encoding optimizations
- **State Management**: TanStack Query, React Hook Form
- **Routing**: Wouter (lightweight client-side routing)
- **Process Management**: PM2 with ecosystem configuration
- **Web Server**: Nginx reverse proxy

## 🏗️ Architecture

```
VideoMaestro/
├── client/          # React frontend application
├── server/          # Express.js backend API
├── shared/          # Shared TypeScript schemas
├── temp/           # Temporary processing files
├── output/         # Generated video files
└── logs/           # Application logs
```

## 🛠️ Installation

### Prerequisites

- Node.js 18+ and npm
- FFmpeg (required for video processing)
- Ubuntu 22.04+ (for production deployment)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/videomaestro.git
   cd videomaestro
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000

## 🚀 Production Deployment

### Automated DigitalOcean Setup

1. **Create a DigitalOcean Droplet**
   - Ubuntu 22.04 LTS
   - Minimum 4GB RAM (8GB recommended)
   - 80GB SSD storage

2. **Run setup script**
   ```bash
   curl -fsSL https://raw.githubusercontent.com/yourusername/videomaestro/main/digitalocean-setup.sh | sudo bash
   ```

3. **Clone and deploy**
   ```bash
   cd /var/www/video-generator
   git clone https://github.com/yourusername/videomaestro.git .
   chmod +x deploy.sh
   ./deploy.sh
   ```

4. **Configure domain**
   ```bash
   # Edit nginx configuration
   sudo nano /etc/nginx/sites-available/video-generator
   # Replace YOUR_DOMAIN.com with your actual domain
   sudo nginx -t && sudo systemctl reload nginx
   ```

5. **Set up SSL (optional)**
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

### Manual Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed manual deployment instructions.

## 📖 API Documentation

### Create Video Job

```http
POST /api/video-jobs
Content-Type: application/json

{
  "video_creation_id": "unique-id",
  "title": "My Awesome Video",
  "channel_id": "channel-123",
  "thumbnail_url": "https://example.com/thumbnail.jpg",
  "songs": [
    {
      "file_url": "https://example.com/song1.mp3",
      "length": 180
    },
    // ... 9 more songs (exactly 10 required)
  ]
}
```

### Get Job Status

```http
GET /api/video-jobs/{job_id}
```

### Get All Jobs

```http
GET /api/video-jobs
```

### Get Statistics

```http
GET /api/stats
```

## 🎛️ Configuration

### Video Processing Settings

- **Duration**: 30 minutes (1800 seconds)
- **Resolution**: 1920x1080 (1080p)
- **Frame Rate**: 0.5fps (optimized for thumbnails)
- **Audio**: 48kbps AAC, mono, 22050Hz
- **Video**: H.264, ultrafast preset, CRF 35

### Performance Optimizations

- **FFmpeg**: Ultra-fast encoding with minimal quality loss
- **Concurrency**: Batched downloads (3 files at a time)
- **Memory**: 2GB max restart limit
- **Cleanup**: Automatic temp file removal

## 📊 Monitoring

### PM2 Commands

```bash
# Check status
pm2 status

# View logs
pm2 logs video-generator

# Restart application
pm2 restart video-generator

# Monitor resources
pm2 monit
```

### Health Check

```bash
# API health check
curl http://localhost:3000/api/stats

# Nginx health check
curl http://localhost/health
```

## 🔧 Development

### Project Structure

```
client/
├── src/
│   ├── components/     # React components
│   ├── hooks/         # Custom React hooks
│   ├── pages/         # Page components
│   └── lib/           # Utility functions

server/
├── services/          # Business logic
├── routes.ts          # API routes
├── storage.ts         # Data storage
└── index.ts          # Application entry point

shared/
└── schema.ts         # TypeScript schemas
```

### Key Files

- `server/services/videoProcessor.ts` - Core FFmpeg processing logic
- `server/routes.ts` - API endpoints and request handling
- `shared/schema.ts` - TypeScript schemas and validation
- `ecosystem.config.js` - PM2 process configuration
- `nginx.conf` - Production web server configuration

## 🚨 Troubleshooting

### Common Issues

1. **FFmpeg not found**
   ```bash
   sudo apt update && sudo apt install ffmpeg
   ```

2. **Permission denied**
   ```bash
   sudo chown -R www-data:www-data /var/www/video-generator
   ```

3. **Out of memory**
   ```bash
   # Increase PM2 memory limit
   pm2 restart video-generator --max-memory-restart 4G
   ```

4. **Nginx 502 error**
   ```bash
   # Check PM2 status
   pm2 status
   # Check nginx error logs
   sudo tail -f /var/log/nginx/error.log
   ```

## 🔐 Security

- Environment variables for sensitive data
- Rate limiting for API endpoints
- Input validation and sanitization
- CORS configuration
- SSL/TLS encryption (production)

## 📈 Performance

- **Processing Time**: ~5-10 minutes per 30-minute video
- **Concurrent Jobs**: 3 maximum (configurable)
- **Memory Usage**: ~1-2GB per job
- **Storage**: ~50-100MB per generated video

## 🛣️ Roadmap

- [ ] Database persistence (PostgreSQL)
- [ ] Redis job queue for scaling
- [ ] AWS S3 integration for video storage
- [ ] Docker containerization
- [ ] Advanced video effects and transitions
- [ ] User authentication and management
- [ ] Video templates and themes

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For support, please create an issue in the GitHub repository or contact the maintainers.

---

**Built with ❤️ for creators who need fast, reliable video generation.**