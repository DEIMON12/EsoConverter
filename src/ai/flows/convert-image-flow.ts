
'use server';
/**
 * @fileOverview An image conversion utility that uses a dedicated API route.
 *
 * - convertImage - A function that calls an API endpoint to handle image conversion.
 * - ConvertImageInput - The input type for the convertImage function.
 * - ConvertImageOutput - The return type for the convertImage function.
 */

import { z } from 'zod';

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

// This function now calls our new API route for conversion.
export async function convertImage(input: ConvertImageInput): Promise<ConvertImageOutput> {
  // In a real application, you would get the base URL from environment variables.
  // For this environment, we assume the app runs on localhost:9002.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002';
  
  const response = await fetch(`${baseUrl}/api/convert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Conversion failed');
  }

  const result: ConvertImageOutput = await response.json();
  return result;
}
