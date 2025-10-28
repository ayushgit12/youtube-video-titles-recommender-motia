import { ApiRouteConfig } from 'motia';

// Accept channel name and email
export const config: ApiRouteConfig = {
     name: 'submit-channel',
     type: "api",
     path: '/submit',
     method: 'POST',
     emits: ['yt.submit']

};

interface SubmitRequest {
     channel: string;
     email: string;
}

export const handler = async (req: any, { emit, logger, state }:any) => {
     try{
          logger.info('Received submission request', { body: req.body });
          const { channel , email } = req.body as SubmitRequest;

          if(!channel || !email){
               return {
                    status: 400,
                    body: {
                         error : "Missing channel or email"
                    }
               }
          }

          // validate
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

          if(!emailRegex.test(email)){
               return {
                    status: 400,
                    body: {
                         error : "Invalid email format"
                    }
               }
          }
          const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

          await state.set(`job : ${jobId}`,
               {
                    jobId,
                    channel,
                    email,
                    status: 'queued',
                    createdAt: new Date().toISOString()
               }
          )
          logger.info('Job created' , {
               jobId,
               channel, 
               email
          })
          await emit({
               topic: 'yt.submit',
               data: {
                    jobId,
                    channel,
                    email
               }
          });
          return {
               status: 200,
               body : {
                    success: true,
                    jobId,
                    message: 'Your request has been queued. You will receieve an email soon with improved suggestions for yt videos.'
               }

          }
     } catch (error : any){
          logger.error('Error in submission handler', { error: error.message });
          return {
               status: 500,
               body : {
                    error: 'Internal Server Error'
               }
          }
     }
}