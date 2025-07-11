/**
 * @fileOverview Worker thread for image conversion.
 */
import { parentPort, workerData } from 'worker_threads';
import sharp from 'sharp';
import { z } from 'zod';

const ConvertImageInputSchema = z.object({
  imageDataUri: z.string(),
  outputFormat: z.enum(['jpeg', 'png', 'webp']),
});

async function performConversion() {
  if (!parentPort) {
    return;
  }

  try {
    const { imageDataUri, outputFormat } = ConvertImageInputSchema.parse(workerData);

    const base64Data = imageDataUri.split(';base64,').pop();
    if (!base64Data) {
      throw new Error('Invalid data URI');
    }
    
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    let convertedBuffer: Buffer;
    let mimeType: string;

    const sharpInstance = sharp(imageBuffer);

    switch (outputFormat) {
      case 'jpeg':
        convertedBuffer = await sharpInstance.jpeg().toBuffer();
        mimeType = 'image/jpeg';
        break;
      case 'png':
        convertedBuffer = await sharpInstance.png().toBuffer();
        mimeType = 'image/png';
        break;
      case 'webp':
        convertedBuffer = await sharpInstance.webp().toBuffer();
        mimeType = 'image/webp';
        break;
      default:
        throw new Error(`Unsupported output format: ${outputFormat}`);
    }
    
    const convertedBase64 = convertedBuffer.toString('base64');
    const convertedImageUri = `data:${mimeType};base64,${convertedBase64}`;
    
    parentPort.postMessage({ convertedImageUri });

  } catch (err) {
     const error = err as Error;
     // If there's an error, we post it back to the main thread.
     // The main thread will reject the promise.
     parentPort.postMessage({ error: error.message });
     // It is important to throw the error here to cause the worker to exit with a non-zero code
     throw error;
  }
}

performConversion();
