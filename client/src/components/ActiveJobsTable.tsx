import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Eye, X } from "lucide-react";
import type { VideoJob } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ActiveJobsTableProps {
  onViewJob: (job: VideoJob) => void;
}

export default function ActiveJobsTable({ onViewJob }: ActiveJobsTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: jobs, isLoading, refetch } = useQuery({
    queryKey: ["/api/video-jobs/active"],
    refetchInterval: 2000, // Refresh every 2 seconds
  });

  const cancelJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiRequest("DELETE", `/api/video-jobs/${jobId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Job Cancelled",
        description: "The job has been cancelled successfully."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/video-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel job",
        variant: "destructive"
      });
    }
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      queued: { variant: "secondary" as const, text: "Queued" },
      downloading: { variant: "default" as const, text: "Downloading" },
      processing_audio: { variant: "default" as const, text: "Processing Audio" },
      creating_video: { variant: "default" as const, text: "Creating Video" },
      completed: { variant: "default" as const, text: "Completed" },
      failed: { variant: "destructive" as const, text: "Failed" }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.queued;
    return (
      <Badge variant={config.variant} className="inline-flex items-center">
        {status === "processing_audio" || status === "creating_video" || status === "downloading" ? (
          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
        ) : null}
        {config.text}
      </Badge>
    );
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (isLoading) {
    return (
      <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/4"></div>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Active Jobs</h2>
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="text-gray-400 hover:text-gray-600 p-2"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {!jobs || jobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No active jobs found. Create a new job to get started.
                </td>
              </tr>
            ) : (
              jobs.map((job: VideoJob) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-mono text-gray-600">{job.id.slice(0, 12)}...</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{job.title}</div>
                    <div className="text-sm text-gray-500">Channel: {job.channel_id}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(job.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="w-full">
                      <Progress value={job.progress || 0} className="w-full h-2" />
                      <span className="text-xs text-gray-500 mt-1 block">
                        {job.progress || 0}% - {job.status.replace('_', ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {job.started_at ? getTimeAgo(job.started_at) : getTimeAgo(job.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewJob(job)}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    {!["completed", "failed"].includes(job.status) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelJobMutation.mutate(job.id)}
                        disabled={cancelJobMutation.isPending}
                        className="text-red-600 hover:text-red-900"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
