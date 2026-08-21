import { handle } from 'hono/aws-lambda';
import type { Handler } from 'aws-lambda';
import { app } from './app';
import { runUploadCleanup } from './modules/uploads/cleanup';

const apiHandler = handle(app);

/**
 * One Lambda serves two triggers: API Gateway requests (the normal case) and
 * a daily EventBridge rule (infra/lib/api-stack.ts) that carries a custom
 * `{ task: 'upload-cleanup' }` payload instead of an API Gateway event shape.
 * Reusing the function avoids a second role/log group/cold-start budget line
 * for something that runs once a day.
 */
export const handler: Handler = async (event, context) => {
  if (event && typeof event === 'object' && event.task === 'upload-cleanup') {
    const result = await runUploadCleanup();
    console.log('upload-cleanup', result);
    return result;
  }
  return apiHandler(event, context);
};
