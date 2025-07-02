import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Check, Clock, Download, RefreshCw, AlertCircle } from "lucide-react";
import type { VideoJob } from "@shared/schema";

interface JobDetailsModalProps {
  job: VideoJob | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function JobDetailsModal({ job, isOpen, onClose }: JobDetailsModalProps) {
  if (!job) return null;

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      queued: { variant: "secondary" as const, text: "Queued", icon: Clock },
      downloading: { variant: "default" as const, text: "Downloading", icon: Download },
      processing_audio: { variant: "default" as const, text: "Processing Audio", icon: RefreshCw },
      creating_video: { variant: "default" as const, text: "Creating Video", icon: RefreshCw },
      completed: { variant: "default" as const, text: "Completed", icon: Check },
      failed: { variant: "destructive" as const, text: "Failed", icon: AlertCircle }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.queued;
    const IconComponent = config.icon;
    
    return (
      <Badge variant={config.variant} className="inline-flex items-center">
        <IconComponent className="w-3 h-3 mr-1" />
        {config.text}
      </Badge>
    );
  };

  const processingSteps = [
    { name: "Download Files", completed: ["downloading", "processing_audio", "creating_video", "completed"].includes(job.status) },
    { name: "Analyze Audio", completed: ["processing_audio", "creating_video", "completed"].includes(job.status) },
    { name: "Process Audio", completed: ["creating_video", "completed"].includes(job.status) },
    { name: "Create Video", completed: ["completed"].includes(job.status) },
  ];

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not started";
    return new Date(dateString).toLocaleString();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Job Details</span>
            {getStatusBadge(job.status)}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Job Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job ID</label>
              <p className="text-sm font-mono text-gray-900 break-all">{job.id}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Video Creation ID</label>
              <p className="text-sm font-mono text-gray-900 break-all">{job.video_creation_id}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <p className="text-sm text-gray-900">{job.title}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel ID</label>
              <p className="text-sm text-gray-900">{job.channel_id}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
              <p className="text-sm text-gray-900">{formatDate(job.created_at)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Started</label>
              <p className="text-sm text-gray-900">{formatDate(job.started_at)}</p>
            </div>
          </div>

          {/* Progress */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Overall Progress</label>
            <div className="space-y-2">
              <Progress value={job.progress || 0} className="w-full" />
              <div className="flex justify-between text-sm text-gray-600">
                <span>{job.progress || 0}% complete</span>
                <span>{job.status.replace('_', ' ')}</span>
              </div>
            </div>
          </div>

          {/* Processing Steps */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Processing Steps</label>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="space-y-3">
                {processingSteps.map((step, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 ${
                        step.completed 
                          ? "bg-green-500" 
                          : job.status === "processing_audio" && step.name === "Process Audio"
                            ? "bg-yellow-500"
                            : "bg-gray-300"
                      }`}>
                        {step.completed ? (
                          <Check className="text-white text-xs" size={12} />
                        ) : job.status === "processing_audio" && step.name === "Process Audio" ? (
                          <RefreshCw className="text-white text-xs animate-spin" size={12} />
                        ) : (
                          <span className="text-white text-xs">{index + 1}</span>
                        )}
                      </div>
                      <span className="text-sm text-gray-700">{step.name}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {step.completed ? "Completed" : step.name === "Process Audio" && job.status === "processing_audio" ? "In Progress" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Songs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Songs ({job.songs.length})</label>
            <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto">
              <div className="space-y-2">
                {job.songs.map((song: any, index: number) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <span className="text-gray-900 font-medium">Song {index + 1}</span>
                    <span className="text-gray-500">{Math.floor(song.length / 60)}:{(song.length % 60).toString().padStart(2, '0')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Video URL (if completed) */}
          {job.status === "completed" && job.video_url && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Video URL</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={job.video_url}
                  readOnly
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded bg-gray-50"
                />
                <Button
                  size="sm"
                  onClick={() => window.open(job.video_url!, '_blank')}
                  className="bg-primary-500 hover:bg-primary-600"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </Button>
              </div>
            </div>
          )}

          {/* Error Message (if failed) */}
          {job.status === "failed" && job.error_message && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Error Message</label>
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {job.error_message}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
