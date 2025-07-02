import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import StatsCards from "@/components/StatsCards";
import JobCreationForm from "@/components/JobCreationForm";
import ActiveJobsTable from "@/components/ActiveJobsTable";
import JobDetailsModal from "@/components/JobDetailsModal";
import { Button } from "@/components/ui/button";
import { Clock, Plus } from "lucide-react";
import type { VideoJob } from "@shared/schema";

export default function Dashboard() {
  const [selectedJob, setSelectedJob] = useState<VideoJob | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }) + ' UTC');

  // Update time every second
  useState(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }) + ' UTC');
    }, 1000);
    return () => clearInterval(interval);
  });

  const handleViewJob = (job: VideoJob) => {
    setSelectedJob(job);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedJob(null);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Video Generator Dashboard</h1>
              <p className="text-gray-600">Monitor and manage video processing jobs</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500 flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                <span>{currentTime}</span>
              </div>
              <Button className="bg-primary-500 hover:bg-primary-600 text-white">
                <Plus className="w-4 h-4 mr-2" />
                New Job
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <StatsCards />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <div className="lg:col-span-2">
              <JobCreationForm />
            </div>
            
            {/* Processing Preview */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Processing Preview</h3>
                
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Target Duration</span>
                      <span className="text-sm font-bold text-primary-600">60:00 min</span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Current Songs</span>
                      <span className="text-sm text-gray-600">0 of 10</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Est. Loops</span>
                      <span className="text-sm text-gray-600">~0 loops</span>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Output Specifications (1080p Optimized)</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Resolution: 1920x1080 (Full HD)</li>
                      <li>• Format: MP4 (H.264 veryfast)</li>
                      <li>• Audio: AAC 64kbps</li>
                      <li>• Duration: Exactly 60 minutes</li>
                      <li>• File Size: ~30-80MB</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <h4 className="font-medium text-yellow-900 mb-2">Processing Steps (Ultra-Fast)</h4>
                    <ol className="text-sm text-yellow-800 space-y-1">
                      <li>1. Batch download files (3 at a time)</li>
                      <li>2. Use metadata durations (skip analysis)</li>
                      <li>3. One-step audio concatenation</li>
                      <li>4. Ultra-fast video encoding</li>
                      <li>5. Send webhook notification</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <ActiveJobsTable onViewJob={handleViewJob} />
        </main>
      </div>

      <JobDetailsModal 
        job={selectedJob} 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
      />
    </div>
  );
}
