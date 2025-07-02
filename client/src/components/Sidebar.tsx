import { Video, Gauge, Plus, List, Download, Settings } from "lucide-react";

export default function Sidebar() {
  return (
    <div className="w-64 bg-white shadow-lg border-r border-gray-200 flex flex-col">
      {/* Logo Section */}
      <div className="px-6 py-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
            <Video className="text-white text-lg" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">VideoGen</h1>
            <p className="text-sm text-gray-500">Processing Hub</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        <a href="#" className="flex items-center px-4 py-3 text-primary-600 bg-primary-50 rounded-lg font-medium">
          <Gauge className="w-5 h-5 mr-3" />
          Dashboard
        </a>
        <a href="#" className="flex items-center px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-lg">
          <Plus className="w-5 h-5 mr-3" />
          Create Job
        </a>
        <a href="#" className="flex items-center px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-lg">
          <List className="w-5 h-5 mr-3" />
          Job Queue
        </a>
        <a href="#" className="flex items-center px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-lg">
          <Download className="w-5 h-5 mr-3" />
          Downloads
        </a>
        <a href="#" className="flex items-center px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-lg">
          <Settings className="w-5 h-5 mr-3" />
          Settings
        </a>
      </nav>

      {/* Status Indicator */}
      <div className="px-4 py-4 border-t border-gray-200">
        <div className="flex items-center space-x-3 px-4 py-3 bg-green-50 rounded-lg">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <div>
            <p className="text-sm font-medium text-green-800">Server Online</p>
            <p className="text-xs text-green-600">Running</p>
          </div>
        </div>
      </div>
    </div>
  );
}
