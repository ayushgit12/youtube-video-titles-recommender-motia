import { EventConfig } from "motia";

// converts youtube name to channel ID using youtube data api
export const config = {
     name: 'ResolveChannel',
     type: "event",
     subscribes: ["yt.submit"],
     emits: ["yt.channel.resolved", "yt.channel.error"]

     
};

export const handler = async (eventData: any, { emit, logger, state }: any) => { 
     let jobId: string | undefined;
     let email: string | undefined;

     try{

          const data = eventData || {};
          jobId = data.jobId;
          const channel = data.channel;
          email = data.email;

          logger.info('Resolving channel ID for submission', { jobId, channel, email });

          const  youtube_api_key = process.env.YOUTUBE_API_KEY;
          if(!youtube_api_key){
               throw new Error('Missing YouTube API key in environment variables');
          }

          const jobData = await state.get(`job : ${jobId}`);
          await state.set(`job : ${jobId}`, {
               ...jobData,
               status: 'resolving_channel'
          });

          let channelId: string | null = null;
          let channelName: string = "";

          if(channel.startsWith('@')){
               const handle = channel.substring(1);
               const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(handle)}&key=${youtube_api_key}`;

               const searchResponse = await fetch(searchUrl);
               const searchData = await searchResponse.json();
               console.log('Search Data:', searchData);

               if(searchData.items && searchData.items.length > 0){
                    channelId = searchData.items[0].snippet.channelId;
                    channelName = searchData.items[0].snippet.title;
               }
          }
          else{
               const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet&forUsername=${encodeURIComponent(channel)}&key=${youtube_api_key}`;
               
               const channelResponse = await fetch(channelUrl);
               const channelData = await channelResponse.json();
               

               if(channelData.items && channelData.items.length > 0){
                    channelId = channelData.items[0].id;
                    channelName = channelData.items[0].snippet.title;
               }
          }

          if(!channelId){
               logger.error('Channel not found', { channel });

               await state.set(`job : ${jobId}`, {
                    ...jobData,
                    status: 'failed',
                    error: 'Channel not found'
               });

               await emit({
                    topic: 'yt.channel.error',
                    data: {
                         jobId,
                         email,
                         error: 'Channel not found'
                    }
               });
               return;
          
          }

          

          await emit({
               topic: 'yt.channel.resolved',
               data: {
                    jobId,
                    email,
                    channelId,
                    channelName
               }
          });
          return ;


     }
     catch (error: any) {
          logger.error('Error resolving channel', { error: error.message, jobId, email });

          if(!jobId || !email){
               logger.error('Missing jobId or email, cannot emit error event');
               return;
          }
          const jobData = await state.get(`job : ${jobId}`);
          await state.set(`job : ${jobId}`, {
               ...jobData,
               status: 'failed',
               error: error.message 
          }); 
          await emit({
               topic: 'yt.channel.error',
               data: {
                    jobId,
                    email,
                    error: 'Failed to resolve channel: ' + error.message
               }
          })
     }
};