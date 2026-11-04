/**
 * Conversión de imágenes 100 % local.
 *
 * La imagen se decodifica y se vuelve a codificar dentro del navegador (o de la
 * ventana de la app de escritorio) con un <canvas>. No se sube a ningún servidor
 * y no necesita conexión a internet.
 */

export const OUTPUT_FORMATS = ['png', 'jpeg', 'webp'] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

const MIME: Record<OutputFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

/** Extensión de archivo para cada formato de salida. */
export const EXTENSION: Record<OutputFormat, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
};

export interface ConvertOptions {
  /** Calidad entre 0 y 1 para JPEG y WEBP (PNG no tiene pérdida y la ignora). */
  quality?: number;
  /** Color de fondo para JPEG, que no admite transparencia. */
  background?: string;
}

/** Decodifica el archivo. Usa createImageBitmap y, si el formato no lo admite, un <img>. */
async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
    } catch {
      URL.revokeObjectURL(url);
      throw new Error('Could not read the image. The format is not supported or the file is damaged.');
    }
  }
}

export async function convertImage(file: File, format: OutputFormat, options: ConvertOptions = {}): Promise<Blob> {
  const { quality = 0.92, background = '#ffffff' } = options;
  const image = await decode(file);

  try {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create a drawing canvas.');

    if (format === 'jpeg') {
      // JPEG no tiene canal alfa: sin fondo, lo transparente saldría negro.
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(image.source, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, MIME[format], quality));
    if (!blob) throw new Error('Could not generate the converted image.');
    if (blob.type !== MIME[format]) {
      throw new Error(`This system cannot encode ${format.toUpperCase()} images.`);
    }
    return blob;
  } finally {
    image.close();
  }
}

/** Nombre del archivo de salida: misma base, nueva extensión. */
export function outputName(fileName: string, format: OutputFormat): string {
  const dot = fileName.lastIndexOf('.');
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  return `${base}.${EXTENSION[format]}`;
}
