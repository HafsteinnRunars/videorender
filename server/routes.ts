import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertVideoJobSchema } from "@shared/schema";
import { z } from "zod";
import { processVideo } from "./services/videoProcessor";
import path from "path";
import fs from "fs";
import { 
  rateLimiter, 
  corsHandler, 
  securityHeaders, 
  validateRequest, 
  sanitizeInput, 
  errorHandler, 
  healthCheck 
} from "./middleware/security";

// Simple in-memory rate limiting
const activeJobs = new Set<string>();

export async function registerRoutes(app: Express): Promise<Server> {
  // Apply security middleware
  app.use(corsHandler);
  app.use(securityHeaders);
  app.use(sanitizeInput);
  
  // Health check endpoint (before rate limiting)
  app.get("/health", healthCheck);
  app.get("/api/health", healthCheck);
  // Create video job endpoint (asynchronous processing - returns immediately)
  app.post("/api/video-jobs", rateLimiter, validateRequest(insertVideoJobSchema), async (req, res) => {
    try {
      const jobData = insertVideoJobSchema.parse(req.body);
      
      // Check for duplicate/similar requests
      const jobKey = `${jobData.title}-${jobData.thumbnail_url}`;
      if (activeJobs.has(jobKey)) {
        return res.status(429).json({
          error: "Duplicate request",
          message: "A similar video is already being processed. Please wait."
        });
      }
      
      // Mark this job as active
      activeJobs.add(jobKey);
      
      const job = await storage.createVideoJob(jobData);
      
      console.log(`🎬 Starting asynchronous processing for job ${job.id}`);
      
      // Process video asynchronously - don't wait for completion
      processVideo(job.id, jobData, storage).then(() => {
        console.log(`✅ Job ${job.id} completed successfully`);
        activeJobs.delete(jobKey);
      }).catch((error) => {
        console.error(`❌ Job ${job.id} failed:`, error);
        activeJobs.delete(jobKey);
      });
      
      // Return immediately with job ID
      res.status(202).json({
        job_id: job.id,
        status: "queued",
        message: "Video processing started. Use GET /api/video-jobs/" + job.id + " to check status."
      });
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: error.errors 
        });
      }
      console.error("Error creating video job:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all jobs
  app.get("/api/video-jobs", async (req, res) => {
    try {
      const jobs = await storage.getAllVideoJobs();
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get active jobs
  app.get("/api/video-jobs/active", async (req, res) => {
    try {
      const jobs = await storage.getActiveVideoJobs();
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching active jobs:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get specific job
  app.get("/api/video-jobs/:id", async (req, res) => {
    try {
      const job = await storage.getVideoJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("Error fetching job:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get job statistics
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getJobStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Cancel job
  app.delete("/api/video-jobs/:id", async (req, res) => {
    try {
      const job = await storage.getVideoJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (["completed", "failed"].includes(job.status)) {
        return res.status(400).json({ error: "Cannot cancel completed or failed job" });
      }
      
      await storage.updateVideoJob(req.params.id, { 
        status: "failed", 
        error_message: "Cancelled by user",
        failed_at: new Date()
      });
      
      res.json({ message: "Job cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling job:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Test webhook environment
  app.get("/api/webhook-test", (req, res) => {
    res.json({ 
      webhook_url: process.env.WEBHOOK_URL || "NOT_SET",
      env_vars: Object.keys(process.env).filter(k => k.includes('WEBHOOK'))
    });
  });

  // Serve generated videos
  app.get("/api/videos/:filename", (req, res) => {
    try {
      const filename = req.params.filename;
      const videoPath = path.join(process.cwd(), "output", filename);
      
      if (!fs.existsSync(videoPath)) {
        return res.status(404).json({ error: "Video not found" });
      }
      
      res.sendFile(videoPath);
    } catch (error) {
      console.error("Error serving video:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Apply error handling middleware last
  app.use(errorHandler);
  
  const httpServer = createServer(app);
  return httpServer;
}
