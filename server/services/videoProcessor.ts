import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import type { IStorage } from '../storage';
import type { InsertVideoJob } from '@shared/schema';

const TEMP_DIR = './temp';
const OUTPUT_DIR = './output';
const TARGET_DURATION = 3600; // 60 minutes
const WEBHOOK_URL = process.env.WEBHOOK_URL || '';

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
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.statusText}`);
  }
  const buffer = await response.buffer();
  await fs.writeFile(filepath, buffer);
  console.log(`✅ Downloaded: ${path.basename(filepath)}`);
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

// Send webhook notification
async function sendWebhook(jobId: string, status: string, data: any) {
  if (!WEBHOOK_URL) return;
  
  try {
    const payload = {
      job_id: jobId,
      status,
      ...data,
      timestamp: new Date().toISOString()
    };
    
    console.log('📡 Sending webhook...');
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      console.error('❌ Webhook failed:', response.statusText);
    } else {
      console.log('✅ Webhook sent successfully');
    }
  } catch (error) {
    console.error('❌ Webhook error:', error);
  }
}

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
    
    // Skip audio analysis - use provided song lengths (much faster!)
    console.log('🎵 Using provided song durations (ultra-fast mode)...');
    let totalDuration = 0;
    
    for (let i = 0; i < requestData.songs.length; i++) {
      totalDuration += requestData.songs[i].length;
      console.log(`Song ${i + 1}: ${requestData.songs[i].length}s (from metadata)`);
    }
    
    console.log(`📊 Total single loop duration: ${Math.round(totalDuration)}s (${Math.round(totalDuration/60)}min)`);
    
    // Update progress
    await storage.updateVideoJob(jobId, { progress: 45 });
    
    // Calculate loops and create concatenation file
    const loopsNeeded = Math.ceil(TARGET_DURATION / totalDuration);
    console.log(`🔄 Loops needed: ${loopsNeeded}`);
    
    const concatFilePath = path.join(jobDir, 'concat.txt');
    let concatContent = '';
    let currentDuration = 0;
    
    // Add songs in loops until exactly 60 minutes
    outerLoop: for (let loop = 0; loop < loopsNeeded; loop++) {
      for (let i = 0; i < songPaths.length; i++) {
        const songDuration = requestData.songs[i].length;
        
        if (currentDuration + songDuration > TARGET_DURATION) {
          const remainingTime = TARGET_DURATION - currentDuration;
          concatContent += `file '${path.basename(songPaths[i])}'\n`;
          console.log(`✂️ Final song will be cut to ${remainingTime}s`);
          break outerLoop;
        }
        
        concatContent += `file '${path.basename(songPaths[i])}'\n`;
        currentDuration += songDuration;
        
        if (currentDuration >= TARGET_DURATION) break outerLoop;
      }
    }
    
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
    
    // Create final video with ultra-fast settings
    console.log('🎬 Creating final video with ultra-fast encoding...');
    const outputVideoPath = path.join(OUTPUT_DIR, `${jobId}.mp4`);
    await executeFFmpeg(
      `ffmpeg -loop 1 -i "${thumbnailPath}" -i "${trimmedAudioPath}" -c:v libx264 -preset ultrafast -crf 28 -tune stillimage -x264-params keyint=600:min-keyint=600 -r 1 -c:a copy -pix_fmt yuv420p -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2" -movflags +faststart -t ${TARGET_DURATION} "${outputVideoPath}"`
    );
    
    console.log(`✅ Job ${jobId}: Video created successfully`);
    
    // Generate video URL
    const videoUrl = `${process.env.REPL_URL || 'http://localhost:5000'}/api/videos/${jobId}.mp4`;
    
    // Update job status to completed
    await storage.updateVideoJob(jobId, { 
      status: 'completed',
      progress: 100,
      video_url: videoUrl,
      completed_at: new Date()
    });
    
    // Send webhook notification
    await sendWebhook(jobId, 'completed', {
      video_url: videoUrl,
      video_creation_id: requestData.video_creation_id,
      title: requestData.title,
      channel_id: requestData.channel_id,
      duration_seconds: TARGET_DURATION
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
    
    await sendWebhook(jobId, 'failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      video_creation_id: requestData.video_creation_id,
      title: requestData.title,
      channel_id: requestData.channel_id
    });
    
    // Clean up temp files even on failure
    try {
      await fs.rm(jobDir, { recursive: true });
      console.log(`🧹 Cleaned up temp files for failed job ${jobId}`);
    } catch (cleanupError) {
      console.error(`⚠️ Failed to clean up temp files for failed job ${jobId}:`, cleanupError);
    }
  }
}
