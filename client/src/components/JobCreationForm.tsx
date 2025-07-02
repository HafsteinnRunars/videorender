import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { insertVideoJobSchema, type InsertVideoJob, type Song } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { CloudUpload, Music, Trash, Plus, Video } from "lucide-react";

export default function JobCreationForm() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertVideoJob>({
    resolver: zodResolver(insertVideoJobSchema),
    defaultValues: {
      title: "",
      channel_id: "",
      video_creation_id: "",
      thumbnail_url: "",
      songs: []
    }
  });

  const createJobMutation = useMutation({
    mutationFn: async (data: InsertVideoJob) => {
      const response = await apiRequest("POST", "/api/video-jobs", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Job Created",
        description: "Video processing has started successfully."
      });
      form.reset();
      setSongs([]);
      setThumbnailUrl("");
      queryClient.invalidateQueries({ queryKey: ["/api/video-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create video job",
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: InsertVideoJob) => {
    if (songs.length !== 10) {
      toast({
        title: "Invalid Song Count",
        description: "Exactly 10 songs are required.",
        variant: "destructive"
      });
      return;
    }

    const jobData: InsertVideoJob = {
      ...data,
      thumbnail_url: thumbnailUrl,
      songs: songs,
      video_creation_id: `vid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    createJobMutation.mutate(jobData);
  };

  const addSong = () => {
    if (songs.length >= 10) {
      toast({
        title: "Maximum Songs Reached",
        description: "You can only add up to 10 songs.",
        variant: "destructive"
      });
      return;
    }

    const title = prompt("Enter song title:");
    const fileUrl = prompt("Enter song URL (MP3/WAV):");
    const lengthStr = prompt("Enter song duration in seconds:");

    if (title && fileUrl && lengthStr) {
      const length = parseInt(lengthStr);
      if (isNaN(length) || length <= 0) {
        toast({
          title: "Invalid Duration",
          description: "Please enter a valid duration in seconds.",
          variant: "destructive"
        });
        return;
      }

      const newSong: Song = {
        title,
        file_url: fileUrl,
        length
      };

      setSongs(prev => [...prev, newSong]);
    }
  };

  const removeSong = (index: number) => {
    setSongs(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
      <CardContent className="p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Create New Video Job</h2>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">Video Title</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter video title"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="channel_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">Channel ID</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter channel ID"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Thumbnail Upload */}
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">Thumbnail Image URL</Label>
              <Input
                type="url"
                placeholder="Enter thumbnail image URL"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="text-sm text-gray-500 mt-2">PNG, JPG. Recommended: 1920x1080</p>
            </div>

            {/* Songs Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <Label className="text-sm font-medium text-gray-700">Songs (10 required)</Label>
                <span className="text-sm text-gray-500">{songs.length} of 10 added</span>
              </div>
              
              {/* Song List */}
              <div className="space-y-3 mb-4">
                {songs.map((song, index) => (
                  <div key={index} className="flex items-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mr-4">
                      <Music className="text-primary-600" size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{song.title}</p>
                      <p className="text-sm text-gray-500">{Math.floor(song.length / 60)}:{(song.length % 60).toString().padStart(2, '0')} - MP3</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSong(index)}
                      className="text-red-500 hover:text-red-700 p-2"
                    >
                      <Trash size={16} />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Add Song Button */}
              <Button
                type="button"
                variant="outline"
                onClick={addSong}
                disabled={songs.length >= 10}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Song (MP3, WAV)
              </Button>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-6 border-t border-gray-200">
              <Button 
                type="submit" 
                disabled={createJobMutation.isPending || songs.length !== 10 || !thumbnailUrl}
                className="bg-primary-500 hover:bg-primary-600 text-white px-8 py-3 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Video className="w-4 h-4 mr-2" />
                {createJobMutation.isPending ? "Creating..." : "Generate Video"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
