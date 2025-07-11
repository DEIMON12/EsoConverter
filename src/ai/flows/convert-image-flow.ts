
'use server';
/**
 * @fileOverview An image conversion utility.
 *
 * - convertImage - A function that handles the image conversion process.
 * - ConvertImageInput - The input type for the convertImage function.
 * - ConvertImageOutput - The return type for the convertImage function.
 */

import { z } from 'zod';
import sharp from 'sharp';

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
  const { imageDataUri, outputFormat } = ConvertImageInputSchema.parse(input);

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
        // This case should not be reachable due to the Zod schema validation
        throw new Error(`Unsupported output format: ${outputFormat}`);
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
