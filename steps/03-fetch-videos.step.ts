import { EventConfig } from "motia";

// retrieves the latest 5 videos for a given channel ID
export const config: EventConfig = {
     name: 'FetchVideos',
     type: "event",
     subscribes: ["yt.channel.resolved"],
     emits: ["yt.videos.fetched", "yt.videos.error"]

     
};

interface Video{
     videoId: string;
     title: string;
     publishedAt: string;
     url: string;
     thumbnail: string;
}

export const handler = async (eventData: any, { emit, logger, state }: any) => { 
     let jobId: string | undefined;
     let email: string | undefined;     

     try{
          const data = eventData || {};
          jobId = data.jobId;
          const channelId = data.channelId;
          email = data.email;

          logger.info('Fetching videos for channel', { jobId, channelId, email });

          const  youtube_api_key = process.env.YOUTUBE_API_KEY;
          if(!youtube_api_key){
               throw new Error('Missing YouTube API key in environment variables');
          }
          
          const jobData = await state.get(`job : ${jobId}`);
          await state.set(`job : ${jobId}`, {
               ...jobData,
               status: 'fetching_videos'
          });
          
          const videosUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(channelId)}&maxResults=5&order=date&type=video&key=${youtube_api_key}`;

          const videosResponse = await fetch(videosUrl);
          const videosData = await videosResponse.json();
          

          if(!videosData || videosData.items.length === 0){
               logger.warn('No videos found for channel', { jobId, channelId });
               await state.set(`job : ${jobId}`, {
                    ...jobData,
                    status: "failed",
                    error: "No videos found"
               });

               await emit({
                    topic: 'yt.videos.error',
                    data: {
                         jobId,
                         email,
                         error: 'No videos found for the specified channel.'
                    } 
               })
               return;
          }

          const videos: Video[] = videosData.items.map((item: any) => ({
               videoId: item.id.videoId,
               title: item.snippet.title,
               publishedAt: item.snippet.publishedAt,
               url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
               thumbnail: item.snippet.thumbnails.default.url
          }));

          logger.info('Fetched videos', { jobId, videoCount: videos.length });

          await state.set(`job : ${jobId}`, {
               ...jobData,
               status: 'videos_fetched',
               videos
          });

          logger.info('Videos fetched successfully', { jobId, videoCount: videos.length, email });

          await emit({
               topic: 'yt.videos.fetched',
               data: {
                    jobId,
                    email,
                    videos,
                    channelId
               }
          });


     }
     catch (error: any) {
          logger.error('Error fetching videos', { error: error.message, jobId, email });

          if(!jobId || !email){
               logger.error('Cannot send error notification due to missing jobId or email');
               return;
          }
          const jobData = await state.get(`job : ${jobId}`);
          await state.set(`job : ${jobId}`, {
               ...jobData,
               status: 'failed',
               error: error.message 
          }); 
          await emit({
               topic: 'yt.videos.error',
               data: {
                    jobId,
                    email,
                    error: 'Failed to fetch videos. Please try again later.'
               }
          })
     }


}