import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import type { IStorage } from '../storage';
import type { InsertVideoJob } from '@shared/schema';

const TEMP_DIR = './temp';
const OUTPUT_DIR = './output';
const TARGET_DURATION = 300; // 5 minutes

// Initialize directories
async function initDirectories() {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating directories:', error);
  }
}

// Download file utility
async function downloadFile(url: string, filepath: string): Promise<string> {
  console.log(`⬇️ Downloading: ${url}`);
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; VideoGenerator/1.0)'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.statusText}`);
  }

  // Check content type for images
  const contentType = response.headers.get('content-type');
  if (filepath.includes('thumbnail') && contentType) {
    if (!contentType.startsWith('image/')) {
      console.error(`❌ Invalid content type from ${url}: ${contentType}`);
      throw new Error(`Invalid image format from ${url}: got ${contentType}, expected image/*`);
    }
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  // Validate PNG/JPEG signatures for images
  if (filepath.includes('thumbnail')) {
    const signature = buffer.subarray(0, 8);
    const isPNG = signature[0] === 0x89 && signature[1] === 0x50 && signature[2] === 0x4E && signature[3] === 0x47;
    const isJPEG = signature[0] === 0xFF && signature[1] === 0xD8;
    
    if (!isPNG && !isJPEG) {
      const hexSignature = Array.from(signature).map(b => b.toString(16).padStart(2, '0')).join('');
      const textSignature = Array.from(signature).map(b => String.fromCharCode(b)).join('');
      console.error(`❌ Invalid image signature from ${url}:`);
      console.error(`   Hex: ${hexSignature}`);
      console.error(`   Text: ${textSignature}`);
      console.error(`   First 100 chars: ${buffer.toString().substring(0, 100)}`);
      throw new Error(`Invalid image file from ${url}: got signature ${hexSignature}, expected PNG (89504E47) or JPEG (FFD8)`);
    }
  }
  
  await fs.writeFile(filepath, buffer);
  console.log(`✅ Downloaded: ${path.basename(filepath)} (${buffer.length} bytes)`);
  return filepath;
}

// Get audio duration using FFprobe
function getAudioDuration(filepath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    exec(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filepath}"`, 
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(parseFloat(stdout.trim()));
        }
      });
  });
}

// Execute FFmpeg command
function executeFFmpeg(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log('🎥 Executing FFmpeg...');
    exec(command, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ FFmpeg error:', error);
        console.error('❌ FFmpeg stderr:', stderr);
        reject(error);
      } else {
        console.log('✅ FFmpeg completed successfully');
        resolve(stdout);
      }
    });
  });
}

// Webhook functionality removed - using synchronous responses only

export async function processVideo(jobId: string, requestData: InsertVideoJob, storage: IStorage) {
  await initDirectories();
  const jobDir = path.join(TEMP_DIR, jobId);
  
  try {
    await fs.mkdir(jobDir, { recursive: true });
    console.log(`🎬 Starting job ${jobId}: "${requestData.title}"`);
    
    // Update job status to downloading
    await storage.updateVideoJob(jobId, { 
      status: 'downloading',
      started_at: new Date(),
      progress: 5
    });
    
    // Download files with optimized concurrency
    const thumbnailPath = path.join(jobDir, 'thumbnail.png');
    const songPaths: string[] = [];
    
    console.log('📥 Starting ultra-fast downloads with batching...');
    
    // Download thumbnail first (smaller, faster)
    await downloadFile(requestData.thumbnail_url, thumbnailPath);
    
    // Download songs in batches of 3 to avoid overwhelming the server
    const batchSize = 3;
    for (let i = 0; i < requestData.songs.length; i += batchSize) {
      const batch = requestData.songs.slice(i, i + batchSize);
      const batchPromises = batch.map((song, batchIndex) => {
        const actualIndex = i + batchIndex;
        const songPath = path.join(jobDir, `song_${actualIndex}.mp3`);
        songPaths[actualIndex] = songPath;
        return downloadFile(song.file_url, songPath);
      });
      
      await Promise.all(batchPromises);
      console.log(`✅ Downloaded batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(requestData.songs.length/batchSize)}`);
    }
    
    console.log(`✅ Job ${jobId}: All ${requestData.songs.length + 1} files downloaded`);
    
    // Update progress
    await storage.updateVideoJob(jobId, { 
      status: 'processing_audio',
      progress: 25
    });
    
    // Get actual audio durations for accurate looping
    console.log('🎵 Analyzing actual audio durations for proper looping...');
    let totalDuration = 0;
    const actualDurations: number[] = [];
    
    for (let i = 0; i < songPaths.length; i++) {
      const duration = await getAudioDuration(songPaths[i]);
      actualDurations.push(duration);
      totalDuration += duration;
      console.log(`Song ${i + 1}: ${Math.round(duration * 10) / 10}s (actual duration)`);
    }
    
    console.log(`📊 Total single loop duration: ${Math.round(totalDuration * 10) / 10}s (${Math.round(totalDuration/60 * 10) / 10}min)`);
    
    // Update progress
    await storage.updateVideoJob(jobId, { progress: 45 });
    
    // Calculate loops and create concatenation file
    const loopsNeeded = Math.ceil(TARGET_DURATION / totalDuration);
    console.log(`🔄 Loops needed: ${loopsNeeded}`);
    
    const concatFilePath = path.join(jobDir, 'concat.txt');
    let concatContent = '';
    let currentDuration = 0;
    
    // Add songs in loops until target duration is reached
    console.log(`🔄 Creating audio sequence for ${TARGET_DURATION}s duration...`);
    outerLoop: for (let loop = 0; loop < loopsNeeded; loop++) {
      console.log(`  Loop ${loop + 1}/${loopsNeeded}:`);
      for (let i = 0; i < songPaths.length; i++) {
        const songDuration = actualDurations[i];
        
        if (currentDuration + songDuration > TARGET_DURATION) {
          const remainingTime = TARGET_DURATION - currentDuration;
          concatContent += `file '${path.basename(songPaths[i])}'\n`;
          console.log(`    Song ${i + 1}: ${Math.round(songDuration * 10) / 10}s ✂️ (cut to ${Math.round(remainingTime * 10) / 10}s)`);
          break outerLoop;
        }
        
        concatContent += `file '${path.basename(songPaths[i])}'\n`;
        currentDuration += songDuration;
        console.log(`    Song ${i + 1}: ${Math.round(songDuration * 10) / 10}s (total: ${Math.round(currentDuration * 10) / 10}s)`);
        
        if (currentDuration >= TARGET_DURATION) break outerLoop;
      }
    }
    
    console.log(`📋 Total entries in playlist: ${concatContent.split('\n').filter(line => line.trim()).length}`);
    console.log(`⏱️ Expected audio duration: ${Math.round(currentDuration * 10) / 10}s`)
    
    await fs.writeFile(concatFilePath, concatContent);
    console.log('📄 Concatenation file created');
    
    // Update progress
    await storage.updateVideoJob(jobId, { progress: 65 });
    
    // Skip individual concatenation - do everything in one ultra-fast step
    console.log('🎵 Creating final audio track (ultra-fast mode)...');
    const trimmedAudioPath = path.join(jobDir, 'final_audio.aac');
    await executeFFmpeg(
      `cd "${jobDir}" && ffmpeg -f concat -safe 0 -i "${path.basename(concatFilePath)}" -t ${TARGET_DURATION} -c:a aac -b:a 64k -ar 44100 -ac 2 "${path.basename(trimmedAudioPath)}"`
    );
    
    // Update job status to creating video
    await storage.updateVideoJob(jobId, { 
      status: 'creating_video',
      progress: 85
    });
    
    // Create final 1080p video with speed optimizations
    console.log('🎬 Creating final 1080p video with speed optimizations...');
    const tempVideoPath = path.join(jobDir, `${jobId}.mp4`);
    const outputVideoPath = path.join(OUTPUT_DIR, `${jobId}.mp4`);
    
    await executeFFmpeg(
      `cd "${jobDir}" && ffmpeg -loop 1 -i "${path.basename(thumbnailPath)}" -i "${path.basename(trimmedAudioPath)}" -c:v libx264 -preset veryfast -crf 30 -tune stillimage -x264-params keyint=600:min-keyint=600:no-cabac:no-deblock:partitions=none:me=dia:subme=1:trellis=0 -r 1 -c:a copy -pix_fmt yuv420p -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" -movflags +faststart -t ${TARGET_DURATION} "${jobId}.mp4"`
    );
    
    // Move video to output directory
    await fs.rename(tempVideoPath, outputVideoPath);
    console.log(`✅ Job ${jobId}: Video created and moved to output directory`);
    
    // Generate video URL using the correct Replit environment variable
    const deploymentDomain = process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN;
    const baseUrl = deploymentDomain ? `https://${deploymentDomain}` : 'http://localhost:5000';
    const videoUrl = `${baseUrl}/api/videos/${jobId}.mp4`;
    console.log(`🔗 Generated video URL: ${videoUrl}`);
    
    // Update job status to completed
    await storage.updateVideoJob(jobId, { 
      status: 'completed',
      progress: 100,
      video_url: videoUrl,
      completed_at: new Date()
    });
    
    console.log(`🎉 Job ${jobId}: Completed successfully`);
    
    // Clean up temp files
    try {
      await fs.rm(jobDir, { recursive: true });
      console.log(`🧹 Cleaned up temp files for job ${jobId}`);
    } catch (error) {
      console.error(`⚠️ Failed to clean up temp files for job ${jobId}:`, error);
    }
    
  } catch (error) {
    console.error(`❌ Job ${jobId} failed:`, error);
    
    await storage.updateVideoJob(jobId, { 
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      failed_at: new Date()
    });
    
    // No webhook - error will be returned in the synchronous response
    
    // Clean up temp files even on failure
    try {
      await fs.rm(jobDir, { recursive: true });
      console.log(`🧹 Cleaned up temp files for failed job ${jobId}`);
    } catch (cleanupError) {
      console.error(`⚠️ Failed to clean up temp files for failed job ${jobId}:`, cleanupError);
    }
  }
}
