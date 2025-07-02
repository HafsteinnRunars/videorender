import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Check, Clock, AlertTriangle } from "lucide-react";

export default function StatsCards() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/stats"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-16 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statsData = [
    {
      title: "Active Jobs",
      value: stats?.active || 0,
      icon: Play,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      change: "+12%",
      changeText: "from last hour",
      changeColor: "text-green-600"
    },
    {
      title: "Completed",
      value: stats?.completed || 0,
      icon: Check,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      change: "+8%",
      changeText: "from yesterday",
      changeColor: "text-green-600"
    },
    {
      title: "Queue",
      value: stats?.queued || 0,
      icon: Clock,
      iconBg: "bg-yellow-100",
      iconColor: "text-yellow-600",
      change: "2 min",
      changeText: "avg wait time",
      changeColor: "text-yellow-600"
    },
    {
      title: "Failed",
      value: stats?.failed || 0,
      icon: AlertTriangle,
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      change: "-3%",
      changeText: "from last week",
      changeColor: "text-red-600"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {statsData.map((stat, index) => (
        <Card key={index} className="bg-white rounded-xl shadow-sm border border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 ${stat.iconBg} rounded-lg flex items-center justify-center`}>
                <stat.icon className={`${stat.iconColor} text-xl`} size={24} />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className={`${stat.changeColor} font-medium`}>{stat.change}</span>
              <span className="text-gray-500 ml-2">{stat.changeText}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
