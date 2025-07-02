import { videoJobs, type VideoJob, type InsertVideoJob } from "@shared/schema";

export interface IStorage {
  getVideoJob(id: string): Promise<VideoJob | undefined>;
  getAllVideoJobs(): Promise<VideoJob[]>;
  getActiveVideoJobs(): Promise<VideoJob[]>;
  createVideoJob(job: InsertVideoJob): Promise<VideoJob>;
  updateVideoJob(id: string, updates: Partial<VideoJob>): Promise<VideoJob | undefined>;
  deleteVideoJob(id: string): Promise<boolean>;
  getJobStats(): Promise<{
    active: number;
    completed: number;
    queued: number;
    failed: number;
  }>;
}

export class MemStorage implements IStorage {
  private jobs: Map<string, VideoJob>;
  private currentId: number;

  constructor() {
    this.jobs = new Map();
    this.currentId = 1;
  }

  async getVideoJob(id: string): Promise<VideoJob | undefined> {
    return this.jobs.get(id);
  }

  async getAllVideoJobs(): Promise<VideoJob[]> {
    return Array.from(this.jobs.values()).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  async getActiveVideoJobs(): Promise<VideoJob[]> {
    return Array.from(this.jobs.values())
      .filter(job => !["completed", "failed"].includes(job.status))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async createVideoJob(insertJob: InsertVideoJob): Promise<VideoJob> {
    const id = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const job: VideoJob = {
      ...insertJob,
      id,
      status: "queued",
      progress: 0,
      video_url: null,
      error_message: null,
      created_at: new Date(),
      started_at: null,
      completed_at: null,
      failed_at: null,
    };
    this.jobs.set(id, job);
    return job;
  }

  async updateVideoJob(id: string, updates: Partial<VideoJob>): Promise<VideoJob | undefined> {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    
    const updatedJob = { ...job, ...updates };
    this.jobs.set(id, updatedJob);
    return updatedJob;
  }

  async deleteVideoJob(id: string): Promise<boolean> {
    return this.jobs.delete(id);
  }

  async getJobStats(): Promise<{
    active: number;
    completed: number;
    queued: number;
    failed: number;
  }> {
    const jobs = Array.from(this.jobs.values());
    return {
      active: jobs.filter(j => ["downloading", "processing_audio", "creating_video"].includes(j.status)).length,
      completed: jobs.filter(j => j.status === "completed").length,
      queued: jobs.filter(j => j.status === "queued").length,
      failed: jobs.filter(j => j.status === "failed").length,
    };
  }
}

export const storage = new MemStorage();
