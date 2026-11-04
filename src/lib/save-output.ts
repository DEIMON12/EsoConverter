/**
 * Guarda un archivo convertido.
 *
 * - En la app de escritorio (Electron) se escribe directo en la carpeta de salida
 *   elegida por el usuario, sin diálogos por cada archivo.
 * - En el navegador se usa una descarga normal.
 *
 * En ningún caso el archivo sale de la computadora.
 */

export interface EsoDesktopApi {
  saveFile(name: string, data: ArrayBuffer): Promise<string>;
  getOutputFolder(): Promise<string>;
  chooseOutputFolder(): Promise<string | null>;
  openOutputFolder(): Promise<void>;
}

declare global {
  interface Window {
    esoDesktop?: EsoDesktopApi;
  }
}

export const desktop = (): EsoDesktopApi | undefined =>
  typeof window !== 'undefined' ? window.esoDesktop : undefined;

/** Devuelve la ruta donde quedó el archivo (escritorio) o el nombre descargado (navegador). */
export async function saveOutput(blob: Blob, name: string): Promise<string> {
  const api = desktop();
  if (api) {
    return api.saveFile(name, await blob.arrayBuffer());
  }

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Da tiempo a que el navegador empiece la descarga antes de liberar la memoria.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  return name;
}
