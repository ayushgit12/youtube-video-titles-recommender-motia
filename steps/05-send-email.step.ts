import { EventConfig } from "motia";

// Step -5 : Sends email with the final results to the user

export const config = {
     name: 'SendEmail',
     type: "event",
     subscribes: ["yt.titles.ready"],
     emits: ["yt.email.sent", "yt.email.error"]
     
};


interface ImprovedTitle{
     original: string;
     improved: string;
     rational: string;
     url: string;
}

export const handler = async (eventData: any, { emit, logger, state }: any) => {
     let jobId: string | undefined;
     
     try{
          const data = eventData || {};
          jobId = data.jobId;
          const improvedTitles = data.improvedTitles;
          const email = data.email;
          const channelName = data.channelName;

          logger.info('Sending email with improved titles', { jobId, email, channelName, titleCount: improvedTitles.length });

          const resend_api_key = process.env.RESEND_API_KEY;
          if(!resend_api_key){
               throw new Error('Missing Resend API key in environment variables');
               
          }

          const jobData = await state.get(`job : ${jobId}`);
          await state.set(`job : ${jobId}`, {
               ...jobData,
               status: 'sending_email'
          });

          const emailText = generateEmailText(channelName, improvedTitles);
          const RESEND_EMAIL = process.env.RESEND_FROM_EMAIL;


          const response = await fetch('https://api.resend.com/emails', {
               method: 'POST',
               headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${resend_api_key}`
               },
               body: JSON.stringify({
                    from: RESEND_EMAIL,
                    to: [email],
                    subject: `Your Improved YouTube Titles for ${channelName}`,
                    text: emailText
               })
          });

          if(!response.ok){
               const errorBody = await response.text();
               throw new Error(`Failed to send email: ${response.status} - ${errorBody}`);
          }

          await state.set(`job : ${jobId}`, {
               ...jobData,
               status: 'email_sent'
          });

          await emit('yt.email.sent', {
               jobId,
               email,
               channelName
          });

     }
     catch (error: any){
          logger.error('Error in SendEmail step', { jobId, error: error.message });
          
          const jobData = await state.get(`job : ${jobId}`);
          await state.set(`job : ${jobId}`, {
               ...jobData,
               status: 'email_error',
               error: error.message
          });
          
          await emit('yt.email.error', {
               jobId,
               error: error.message
          });
     }
};




function generateEmailText(channelName: string, titles: ImprovedTitle[]): string {
     let text = `Youtube Title Doctor - Improved Titles for ${channelName}\n`

     text+= `${"=".repeat(60)}\n\n`;

     titles.forEach((title, index) => {
          text += `Video ${index + 1}:\n`;
          text+= `----------\n`;
          text += `Original: ${title.original}\n`;
          text += `Improved: ${title.improved}\n\n`;
          text+= `Why : ${title.rational}\n`;
          text += `Watch: ${title.url}\n\n`;

     });
     text+=`${"=".repeat(60)}\n`;

     return text;
}
