import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import type { IStorage } from '../storage';
import type { InsertVideoJob } from '@shared/schema';

const TEMP_DIR = './temp';
const OUTPUT_DIR = './output';
const TARGET_DURATION = 1800; // 30 minutes

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
    // MAXIMUM SPEED: Use larger buffer for 8GB RAM system
    exec(command, { maxBuffer: 1024 * 1024 * 200 }, (error, stdout, stderr) => {
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
  
  // Keep-alive mechanism to prevent machine from stopping during processing
  const keepAliveInterval = setInterval(() => {
    console.log(`⏰ Keep-alive ping for job ${jobId} - processing in progress...`);
  }, 5 * 60 * 1000); // Every 5 minutes
  
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
    
    // Download songs in batches of 10 to avoid overwhelming the server
    const batchSize = 10; // Download all 10 songs at once - maximum parallelization
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
    
    // MAXIMUM SPEED: Analyze all audio durations in parallel using all CPU cores
    const durationPromises = songPaths.map((songPath, i) => 
      getAudioDuration(songPath).then(duration => ({ index: i, duration }))
    );
    
    const durationResults = await Promise.all(durationPromises);
    durationResults.sort((a, b) => a.index - b.index);
    
    for (const result of durationResults) {
      actualDurations.push(result.duration);
      totalDuration += result.duration;
      console.log(`Song ${result.index + 1}: ${Math.round(result.duration * 10) / 10}s (actual duration)`);
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
    console.log('🎵 Creating final audio track (MAXIMUM SPEED mode)...');
    const trimmedAudioPath = path.join(jobDir, 'final_audio.aac');
    await executeFFmpeg(
      `cd "${jobDir}" && ffmpeg -f concat -safe 0 -i "${path.basename(concatFilePath)}" -t ${TARGET_DURATION} -c:a aac -b:a 128k -ar 48000 -ac 2 -threads 8 -thread_queue_size 2048 -max_muxing_queue_size 4096 "${path.basename(trimmedAudioPath)}"`
    );
    
    // Update job status to creating video
    await storage.updateVideoJob(jobId, { 
      status: 'creating_video',
      progress: 85
    });
    
    // Create final 1080p video with speed optimizations
    console.log('🎬 Creating final 1080p video with MAXIMUM SPEED optimizations...');
    const tempVideoPath = path.join(jobDir, `${jobId}.mp4`);
    const outputVideoPath = path.join(OUTPUT_DIR, `${jobId}.mp4`);
    
    await executeFFmpeg(
      `cd "${jobDir}" && ffmpeg -loop 1 -i "${path.basename(thumbnailPath)}" -i "${path.basename(trimmedAudioPath)}" -c:v libx264 -preset ultrafast -crf 23 -tune stillimage -x264-params keyint=300:min-keyint=300:ref=1:bframes=0:me=dia:subme=0:me_range=4:trellis=0:no-mbtree:no-weightb:no-mixed-refs:aq-mode=0:no-cabac:no-deblock -r 2 -c:a copy -pix_fmt yuv420p -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" -movflags +faststart -t ${TARGET_DURATION} -threads 8 -thread_type slice -thread_queue_size 4096 -max_muxing_queue_size 8192 -bufsize 16M -maxrate 10M "${jobId}.mp4"`
    );
    
    // Move video to output directory
    await fs.rename(tempVideoPath, outputVideoPath);
    console.log(`✅ Job ${jobId}: Video created and moved to output directory`);
    
    // Generate video URL using the correct Fly.io environment variables
    // Use Fly.io domain or fallback to localhost for development
    const flyDomain = process.env.FLY_APP_NAME ? `${process.env.FLY_APP_NAME}.fly.dev` : null;
    const baseUrl = flyDomain ? `https://${flyDomain}` : 'http://localhost:3000';
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
    
    // Clear keep-alive interval
    clearInterval(keepAliveInterval);
    
    // Send webhook notification with complete job details
    try {
      const completedJob = await storage.getVideoJob(jobId);
      if (completedJob) {
        const webhookPayload = {
          job_id: completedJob.id,
          video_creation_id: completedJob.video_creation_id,
          title: completedJob.title,
          channel_id: completedJob.channel_id,
          thumbnail_url: completedJob.thumbnail_url,
          songs: completedJob.songs,
          status: completedJob.status,
          progress: completedJob.progress,
          video_url: completedJob.video_url,
          created_at: completedJob.created_at,
          started_at: completedJob.started_at,
          completed_at: completedJob.completed_at,
          processing_time_seconds: completedJob.started_at && completedJob.completed_at 
            ? Math.round((completedJob.completed_at.getTime() - completedJob.started_at.getTime()) / 1000)
            : null
        };
        
        console.log(`📤 Sending webhook for job ${jobId}:`, webhookPayload);
        
        const webhookResponse = await fetch('https://hook.eu2.make.com/hkxxfxo0fn7kdkgg4icrei2v9oci4zqo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'VideoMaestro/1.0'
          },
          body: JSON.stringify(webhookPayload)
        });
        
        if (webhookResponse.ok) {
          console.log(`✅ Webhook sent successfully for job ${jobId}`);
        } else {
          console.error(`❌ Webhook failed for job ${jobId}: ${webhookResponse.status} ${webhookResponse.statusText}`);
        }
      }
    } catch (webhookError) {
      console.error(`❌ Webhook error for job ${jobId}:`, webhookError);
      // Don't fail the job if webhook fails
    }
    
    // Clean up temp files
    try {
      await fs.rm(jobDir, { recursive: true });
      console.log(`🧹 Cleaned up temp files for job ${jobId}`);
    } catch (error) {
      console.error(`⚠️ Failed to clean up temp files for job ${jobId}:`, error);
    }
    
  } catch (error) {
    console.error(`❌ Job ${jobId} failed:`, error);
    
    // Clear keep-alive interval
    clearInterval(keepAliveInterval);
    
    await storage.updateVideoJob(jobId, { 
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      failed_at: new Date()
    });
    
    // Send webhook notification for failed job
    try {
      const failedJob = await storage.getVideoJob(jobId);
      if (failedJob) {
        const webhookPayload = {
          job_id: failedJob.id,
          video_creation_id: failedJob.video_creation_id,
          title: failedJob.title,
          channel_id: failedJob.channel_id,
          thumbnail_url: failedJob.thumbnail_url,
          songs: failedJob.songs,
          status: failedJob.status,
          progress: failedJob.progress,
          error_message: failedJob.error_message,
          created_at: failedJob.created_at,
          started_at: failedJob.started_at,
          failed_at: failedJob.failed_at,
          processing_time_seconds: failedJob.started_at && failedJob.failed_at 
            ? Math.round((failedJob.failed_at.getTime() - failedJob.started_at.getTime()) / 1000)
            : null
        };
        
        console.log(`📤 Sending webhook for failed job ${jobId}:`, webhookPayload);
        
        const webhookResponse = await fetch('https://hook.eu2.make.com/hkxxfxo0fn7kdkgg4icrei2v9oci4zqo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'VideoMaestro/1.0'
          },
          body: JSON.stringify(webhookPayload)
        });
        
        if (webhookResponse.ok) {
          console.log(`✅ Webhook sent successfully for failed job ${jobId}`);
        } else {
          console.error(`❌ Webhook failed for failed job ${jobId}: ${webhookResponse.status} ${webhookResponse.statusText}`);
        }
      }
    } catch (webhookError) {
      console.error(`❌ Webhook error for failed job ${jobId}:`, webhookError);
    }
    
    // Clean up temp files even on failure
    try {
      await fs.rm(jobDir, { recursive: true });
      console.log(`🧹 Cleaned up temp files for failed job ${jobId}`);
    } catch (cleanupError) {
      console.error(`⚠️ Failed to clean up temp files for failed job ${jobId}:`, cleanupError);
    }
  }
}
