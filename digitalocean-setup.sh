#!/bin/bash

# DigitalOcean Droplet Setup Script for Video Generator
# Run this script on a fresh Ubuntu 22.04 droplet

set -e

echo "🚀 Setting up Video Generator on DigitalOcean..."

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Node.js 20
echo "📥 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install FFmpeg (essential for video processing)
echo "🎬 Installing FFmpeg..."
apt install -y ffmpeg

# Install PM2 for process management
echo "⚙️ Installing PM2..."
npm install -g pm2

# Install Nginx for reverse proxy
echo "🌐 Installing Nginx..."
apt install -y nginx

# Install Git
echo "📂 Installing Git..."
apt install -y git

# Create app directory
echo "📁 Creating application directory..."
mkdir -p /var/www/video-generator
cd /var/www/video-generator

# Clone repository (you'll need to replace this with your GitHub repo URL)
echo "📥 Cloning repository..."
# git clone https://github.com/YOUR_USERNAME/video-generator.git .

echo "⚠️ Please clone your repository manually:"
echo "   cd /var/www/video-generator"
echo "   git clone https://github.com/YOUR_USERNAME/video-generator.git ."

# Create required directories
mkdir -p temp output

# Set proper permissions
chown -R www-data:www-data /var/www/video-generator
chmod -R 755 /var/www/video-generator

echo "✅ Basic setup complete!"
echo "📋 Next steps:"
echo "1. Clone your GitHub repository"
echo "2. Run npm install"
echo "3. Configure environment variables"
echo "4. Set up PM2 and Nginx"