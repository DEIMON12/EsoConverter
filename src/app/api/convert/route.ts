
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { z } from 'zod';

const ConvertRequestSchema = z.object({
  imageDataUri: z.string(),
  outputFormat: z.enum(['jpeg', 'png', 'webp']),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { imageDataUri, outputFormat } = ConvertRequestSchema.parse(body);

    const base64Data = imageDataUri.split(';base64,').pop();
    if (!base64Data) {
      return NextResponse.json({ error: 'Invalid data URI format' }, { status: 400 });
    }

    const imageBuffer = Buffer.from(base64Data, 'base64');
    const sharpInstance = sharp(imageBuffer);

    let convertedBuffer: Buffer;
    let mimeType: string;

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
        // This case is unlikely due to Zod validation but is good for safety
        return NextResponse.json({ error: `Unsupported output format: ${outputFormat}` }, { status: 400 });
    }

    const convertedBase64 = convertedBuffer.toString('base64');
    const convertedImageUri = `data:${mimeType};base64,${convertedBase64}`;

    return NextResponse.json({ convertedImageUri });

  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: err.errors }, { status: 400 });
    }
    const error = err as Error;
    console.error('Conversion Error:', error);
    return NextResponse.json({ error: error.message || 'An internal server error occurred' }, { status: 500 });
  }
}
