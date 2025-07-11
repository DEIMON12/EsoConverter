
'use server';
/**
 * @fileOverview An image conversion AI agent.
 *
 * - convertImage - A function that handles the image conversion process.
 * - ConvertImageInput - The input type for the convertImage function.
 * - ConvertImageOutput - The return type for the convertImage function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import sharp from 'sharp';

const ConvertImageInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "An image to convert, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  outputFormat: z.enum(['jpeg', 'png', 'webp', 'pdf', 'mp3', 'wav']).describe('The desired output format.'),
});
export type ConvertImageInput = z.infer<typeof ConvertImageInputSchema>;

const ConvertImageOutputSchema = z.object({
  convertedImageUri: z.string().describe('The converted image as a data URI.'),
});
export type ConvertImageOutput = z.infer<typeof ConvertImageOutputSchema>;


export async function convertImage(input: ConvertImageInput): Promise<ConvertImageOutput> {
  return convertImageFlow(input);
}

const convertImageFlow = ai.defineFlow(
  {
    name: 'convertImageFlow',
    inputSchema: ConvertImageInputSchema,
    outputSchema: ConvertImageOutputSchema,
  },
  async ({ imageDataUri, outputFormat }) => {
    try {
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
          // For non-image formats, we'll just wrap the original in a 'text' blob for now
          // as we don't have audio/pdf conversion capabilities with sharp.
          // This keeps the download functionality but won't be a valid file.
          return { convertedImageUri: `data:application/octet-stream;base64,${Buffer.from(`Conversion to ${outputFormat} not supported yet.`).toString('base64')}`};
      }
      
      const convertedBase64 = convertedBuffer.toString('base64');
      const convertedImageUri = `data:${mimeType};base64,${convertedBase64}`;
      
      return { convertedImageUri };
    } catch (err) {
       const errorMessage = err instanceof Error ? err.message : 'Unknown conversion error';
       console.error(`Conversion failed: ${errorMessage}`);
       throw new Error(`Conversion failed: ${errorMessage}`);
    }
  }
);
