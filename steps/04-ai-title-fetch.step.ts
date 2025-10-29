import { EventConfig } from "motia";
import OpenAI from "openai";


//Step -4 : Uses openai gemini to fetch better titles for videos

export const config = {
     name: 'FetchAITitles',
     type: "event",
     subscribes: ["yt.videos.fetched"],
     emits: ["yt.titles.ready", "yt.titles.error"]
     
};

interface Video{
     videoId: string;
     title: string;
     publishedAt: string;
     url: string;
     thumbnail: string;
}

interface ImprovedTitle{
     original: string;
     improved: string;
     rational: string;
     url: string;
}

export const handler = async (eventData: any, { emit, logger, state }: any) => {
     let jobId: string | undefined;
     let email: string | undefined;

     try{
          const data = eventData || {};
          jobId = data.jobId;
          const videos: Video[] = data.videos;
          email = data.email;
          const channelName = data.channelName;

          logger.info('Generating AI titles for videos', { jobId, videoCount : videos.length, channelName });

          const gemini_api_key = process.env.GEMINI_API_KEY;
          if(!gemini_api_key){
               throw new Error('Missing Gemini API key in environment variables');

          }

          const jobData = await state.get(`job : ${jobId}`);
          await state.set(`job : ${jobId}`, {
               ...jobData,
               status: 'generating_ai_titles'
          });
          
          const videoTitles = videos.map((v: Video , idx: number)=>
               `${idx + 1}. "${v.title}"`
          ).join('\n');


          const prompt = `You are a youtube title optimization expert. Below are ${videos.length} video titles from a youtube channel named "${channelName}". 
          For each title, provide: 
          1. An improved version that is more engaging, SEO-friendly and likely to get more clicks.
          2. A brief rationale (in 10 words or less) explaining why the new title is better.

          Guidelines:
          - Keep the core meaning of the original title.
          - Use action verbs, numbers, and specific value propositions.
          - Make it curious and clickable without being clickbait.
          - Optimize for relevant keywords.

          Here are the original titles:
          ${videoTitles}

          Respond in the following JSON format:
          {
               "titles": [
                    {
                         "original": "...",
                         "improved": "...",
                         "rational": "..."
                    },
                    
               ]
          }`;

          const openai = new OpenAI({
               apiKey: gemini_api_key,
               baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
          });

          const response = await openai.chat.completions.create({
               model: "gemini-2.0-flash",
               messages: [
                    { role: "system", content: "You are a youtube SEO and engagement expert who helps creators write better youtube titles" },
                    {
                         role: "user",
                         content: prompt
                    },
               ],
          });

          if(!response.choices || response.choices.length === 0){
               throw new Error('No response from Gemini API');
          }

          let airesponse = response.choices[0].message?.content;
          if(!airesponse){
               throw new Error('Empty response from Gemini API');
          }
          airesponse = airesponse.replace(/```json|```/g, '').trim();
          
          const aiData = JSON.parse(airesponse);

          const improvedTitles: ImprovedTitle[] = aiData.titles.map((item: any, index: number) => ({
               original: item.original,
               improved: item.improved,
               rational: item.rational,
               url: videos[index].url
          }));

          logger.info('Generated improved titles successfully', { jobId, titleCount: improvedTitles.length });

          await state.set(`job : ${jobId}`, {
               ...jobData,
               status: 'ai_titles_ready',
               improvedTitles
          });
          
          logger.info('AI titles generated successfully', { jobId, titleCount: improvedTitles.length, email });
          await emit({
               topic: 'yt.titles.ready',
               data: {
                    jobId,
                    email,
                    improvedTitles,
                    channelName
               }
          });
     }
     catch(error: any){
          logger.error('Error generating AI titles', { jobId, error: error.message });
          await emit({
               topic: 'yt.titles.error',
               data: {
                    jobId,
                    email,
                    error: 'Failed to generate improved AI titles: ' + error.message
               }
          })
     }
};