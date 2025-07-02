# VideoGen Processing Hub

## Overview

This is a full-stack video generation application built with Node.js, Express, React, and TypeScript. The system processes video creation jobs that combine thumbnails with audio playlists to generate 60-minute videos. It features a modern dashboard interface for job management and real-time progress tracking.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM configured for PostgreSQL
- **Validation**: Zod schemas for type-safe data validation
- **File Processing**: FFmpeg for video/audio processing (planned)

### Project Structure
```
├── client/          # React frontend application
├── server/          # Express backend API
├── shared/          # Shared TypeScript schemas and types
├── migrations/      # Database migration files
└── dist/           # Production build output
```

## Key Components

### Video Job Management
- **Job Creation**: Form-based interface for creating video processing jobs
- **Job Monitoring**: Real-time dashboard showing active jobs with progress tracking
- **Job Details**: Modal views for detailed job information and status
- **Statistics**: Overview cards showing job counts by status

### Data Models
- **VideoJob**: Core entity storing job metadata, status, and processing information
- **Song**: Audio file references with metadata (title, URL, duration)
- **Job Status**: Enumerated states (queued, downloading, processing_audio, creating_video, completed, failed)

### API Endpoints
- `POST /api/video-jobs` - Create new video processing job
- `GET /api/video-jobs` - Retrieve all jobs
- `GET /api/video-jobs/active` - Get currently active jobs
- `GET /api/stats` - Job statistics summary
- `DELETE /api/video-jobs/:id` - Cancel specific job

## Data Flow

1. **Job Creation**: User submits video creation form with thumbnail URL and 10 audio files
2. **Validation**: Request data validated against Zod schema ensuring correct format
3. **Job Storage**: Job record created in database with "queued" status
4. **Background Processing**: Video processor service handles file downloads and processing
5. **Status Updates**: Real-time progress updates sent to frontend via polling
6. **Completion**: Final video URL returned and webhook notification sent

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Neon PostgreSQL database driver
- **drizzle-orm**: Type-safe ORM for database operations
- **@tanstack/react-query**: Server state management and caching
- **@radix-ui/**: Comprehensive UI primitive components
- **zod**: Runtime type validation and schema definition

### Development Tools
- **Vite**: Frontend build tool with HMR support
- **tsx**: TypeScript execution for development
- **esbuild**: Fast JavaScript bundler for production
- **tailwindcss**: Utility-first CSS framework

### Processing Libraries
- **node-fetch**: HTTP request library for file downloads
- **uuid**: Unique identifier generation for jobs
- **date-fns**: Date/time manipulation utilities

## Deployment Strategy

### Development
- **Frontend**: Vite dev server with hot module replacement
- **Backend**: tsx for TypeScript execution with auto-restart
- **Database**: Drizzle Kit for schema management and migrations

### Production Build
1. **Frontend**: Vite builds optimized React application to `dist/public`
2. **Backend**: esbuild bundles server code to `dist/index.js`
3. **Database**: Drizzle migrations applied via `db:push` command
4. **Startup**: Node.js runs bundled server with static file serving

### Environment Configuration
- `DATABASE_URL`: PostgreSQL connection string (required)
- `WEBHOOK_URL`: External webhook for job completion notifications
- `NODE_ENV`: Environment mode (development/production)
- `PORT`: Server port (defaults to 3000)

## Changelog
- July 02, 2025. Initial setup
- July 02, 2025. Converted to synchronous processing (no webhooks)
- July 02, 2025. Fixed audio looping with actual duration analysis
- July 02, 2025. Added image validation and proper error handling
- July 02, 2025. Fixed video URL generation for deployment domains

## User Preferences

Preferred communication style: Simple, everyday language.