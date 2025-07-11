
'use server';
/**
 * @fileOverview An image conversion utility that uses worker threads.
 *
 * - convertImage - A function that handles the image conversion process using a worker thread.
 * - ConvertImageInput - The input type for the convertImage function.
 * - ConvertImageOutput - The return type for the convertImage function.
 */

import { z } from 'zod';
import { Worker } from 'worker_threads';
import path from 'path';

const ConvertImageInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "An image to convert, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  outputFormat: z.enum(['jpeg', 'png', 'webp']).describe('The desired output format.'),
});
export type ConvertImageInput = z.infer<typeof ConvertImageInputSchema>;

const ConvertImageOutputSchema = z.object({
  convertedImageUri: z.string().describe('The converted image as a data URI.'),
});
export type ConvertImageOutput = z.infer<typeof ConvertImageOutputSchema>;


export async function convertImage(input: ConvertImageInput): Promise<ConvertImageOutput> {
  return new Promise((resolve, reject) => {
    // This is the robust way to get the path to the worker in Next.js
    // It works in both development and production environments.
    const workerPath = path.resolve(process.cwd(), '.next/server/workers/image-converter-worker.js');
    
    const worker = new Worker(workerPath, {
      workerData: input,
    });

    worker.on('message', (result: ConvertImageOutput | { error: string }) => {
      if ('error' in result) {
        reject(new Error(result.error));
      } else {
        resolve(result);
      }
    });

    worker.on('error', (error) => {
      reject(new Error(`Worker error: ${error.message}`));
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}
