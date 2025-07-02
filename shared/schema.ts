import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const videoJobs = pgTable("video_jobs", {
  id: text("id").primaryKey(),
  video_creation_id: text("video_creation_id").notNull(),
  title: text("title").notNull(),
  channel_id: text("channel_id").notNull(),
  thumbnail_url: text("thumbnail_url").notNull(),
  songs: jsonb("songs").notNull(),
  status: text("status").notNull().default("queued"),
  progress: integer("progress").default(0),
  video_url: text("video_url"),
  error_message: text("error_message"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  started_at: timestamp("started_at"),
  completed_at: timestamp("completed_at"),
  failed_at: timestamp("failed_at"),
});

export const songSchema = z.object({
  title: z.string(),
  file_url: z.string().url(),
  length: z.number().positive(),
});

export const insertVideoJobSchema = createInsertSchema(videoJobs).omit({
  id: true,
  created_at: true,
  started_at: true,
  completed_at: true,
  failed_at: true,
}).extend({
  songs: z.array(songSchema).length(10),
});

export type InsertVideoJob = z.infer<typeof insertVideoJobSchema>;
export type VideoJob = typeof videoJobs.$inferSelect;
export type Song = z.infer<typeof songSchema>;

export const jobStatusSchema = z.enum([
  "queued",
  "downloading",
  "processing_audio", 
  "creating_video",
  "completed",
  "failed"
]);

export type JobStatus = z.infer<typeof jobStatusSchema>;
