"use client";

import { useState, useRef, ChangeEvent, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UploadCloud, FileImage, X, Loader2, CheckCircle2, AlertTriangle, History, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { convertImage, ConvertImageInput, ConvertImageOutput } from '@/ai/flows/convert-image-flow';

type ConversionStatus = 'queued' | 'converting' | 'completed' | 'error';

interface ConversionFile {
  id: string;
  file: File;
  status: ConversionStatus;
  progress: number;
  outputName: string;
  error?: string;
}

const fileToDataUri = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

function formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function FileConverter() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [conversionQueue, setConversionQueue] = useState<ConversionFile[]>([]);
  const [outputFormat, setOutputFormat] = useState<string>('png');
  const [isConverting, setIsConverting] = useState<boolean>(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
       if (newFiles.length !== Array.from(files).length) {
        toast({ 
          title: "Archivos no válidos ignorados", 
          description: "Solo se admiten archivos de imagen para la conversión.",
          variant: "destructive"
        });
      }
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
    // Reset file input to allow selecting the same file again
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const updateQueueItem = (id: string, updates: Partial<ConversionFile>) => {
    setConversionQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const performConversion = useCallback(async (item: ConversionFile, format: string) => {
    updateQueueItem(item.id, { status: 'converting', progress: 25 });
    
    try {
      const imageDataUri = await fileToDataUri(item.file);
      updateQueueItem(item.id, { progress: 50 });

      const result = await convertImage({ 
        imageDataUri, 
        outputFormat: format as ConvertImageInput['outputFormat'],
      });
      updateQueueItem(item.id, { progress: 75 });
      
      // Trigger download
      const a = document.createElement('a');
      a.href = result.convertedImageUri;
      a.download = item.outputName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      updateQueueItem(item.id, { status: 'completed', progress: 100 });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      updateQueueItem(item.id, { status: 'error', progress: 0, error: errorMessage });
    }
  }, []);

  const handleConvertClick = async () => {
    if (selectedFiles.length === 0) {
      toast({ title: "No hay archivos seleccionados", description: "Por favor, selecciona imágenes para convertir.", variant: "destructive" });
      return;
    }

    setIsConverting(true);
    setConversionQueue([]); // Clear previous queue

    const newQueue: ConversionFile[] = selectedFiles.map((file, index) => ({
      id: `${file.name}-${file.lastModified}-${index}`,
      file,
      status: 'queued',
      progress: 0,
      outputName: `${file.name.split('.').slice(0, -1).join('.')}.${outputFormat}`,
    }));
    
    setConversionQueue(newQueue);
    setSelectedFiles([]); // Clear selection

    const conversionPromises = newQueue.map(item => performConversion(item, outputFormat));
    
    await Promise.allSettled(conversionPromises);

    setIsConverting(false);
    toast({ title: "Conversiones finalizadas", description: "Todos los archivos han sido procesados." });
  };
  
  const StatusIcon = useMemo(() => ({ status }: { status: ConversionStatus }) => {
    switch (status) {
        case 'converting': return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
        case 'completed': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
        case 'error': return <AlertTriangle className="h-5 w-5 text-red-500" />;
        default: return <History className="h-5 w-5 text-muted-foreground" />;
    }
  }, []);

  return (
    <div className="w-full max-w-6xl mx-auto p-4 md:p-8">
        <header className="flex items-center gap-4 mb-8">
            <div className="bg-primary p-3 rounded-lg shadow-md">
                <Wand2 className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
                <h1 className="text-3xl font-bold text-foreground">ParaConverter</h1>
                <p className="text-muted-foreground">Conversión de archivos rápida y multihilo.</p>
            </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="flex flex-col gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle>1. Seleccionar Archivos</CardTitle>
                        <CardDescription>Arrastra o selecciona las imágenes que quieres convertir.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Label htmlFor="file-upload" className="w-full cursor-pointer group">
                            <div className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg border-border group-hover:border-primary transition-colors">
                                <UploadCloud className="h-12 w-12 text-muted-foreground group-hover:text-primary transition-colors" />
                                <p className="mt-2 text-sm text-muted-foreground">
                                    <span className="font-semibold text-primary">Haz clic para subir</span> o arrastra y suelta
                                </p>
                                <p className="text-xs text-muted-foreground">Soporta PNG, JPG, WEBP</p>
                            </div>
                        </Label>
                        <input id="file-upload" ref={fileInputRef} type="file" className="hidden" multiple onChange={handleFileSelect} accept="image/*" />
                        
                        {selectedFiles.length > 0 && (
                            <div className="mt-4">
                                <h3 className="font-medium mb-2 text-sm">Archivos seleccionados:</h3>
                                <ScrollArea className="h-32 w-full rounded-md border p-2">
                                    {selectedFiles.map((file, index) => (
                                        <div key={`${file.name}-${index}`} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 text-sm">
                                            <div className="flex items-center gap-2 truncate">
                                                <FileImage className="h-5 w-5 text-primary" />
                                                <span className="truncate">{file.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeSelectedFile(index)}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </ScrollArea>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>2. Configurar y Convertir</CardTitle>
                        <CardDescription>Elige el formato de salida y comienza el proceso.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Label htmlFor="output-format">Formato de salida</Label>
                        <Select value={outputFormat} onValueChange={setOutputFormat}>
                            <SelectTrigger id="output-format">
                                <SelectValue placeholder="Selecciona un formato" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="png">PNG</SelectItem>
                                <SelectItem value="jpeg">JPEG</SelectItem>
                                <SelectItem value="webp">WEBP</SelectItem>
                            </SelectContent>
                        </Select>
                    </CardContent>
                    <CardFooter>
                         <Button onClick={handleConvertClick} disabled={isConverting || selectedFiles.length === 0} className="w-full">
                            {isConverting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Procesando...
                                </>
                            ) : (
                                "Convertir Archivos"
                            )}
                        </Button>
                    </CardFooter>
                </Card>
            </div>

            <Card className="lg:col-span-1 flex flex-col">
                <CardHeader>
                    <CardTitle>Progreso de Conversión</CardTitle>
                    <CardDescription>Sigue el estado de tus archivos en tiempo real.</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                    <ScrollArea className={cn("h-96", conversionQueue.length === 0 && "flex items-center justify-center")}>
                        {conversionQueue.length === 0 ? (
                            <div className="text-center text-muted-foreground">
                                <p>La cola de conversión está vacía.</p>
                                <p className="text-xs mt-1">Sube archivos para empezar.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                            {conversionQueue.map(item => (
                                <div key={item.id} className="flex items-center gap-4 p-2 rounded-lg bg-muted/30">
                                    <StatusIcon status={item.status} />
                                    <div className="flex-grow">
                                        <div className="flex justify-between text-sm mb-1">
                                            <p className="truncate font-medium max-w-[200px]">{item.file.name}</p>
                                            <p className="text-muted-foreground flex-shrink-0 capitalize">{item.status}</p>
                                        </div>
                                        <Progress value={item.progress} className={cn(item.status === 'error' && '[&>div]:bg-red-500')} />
                                        {item.status === 'error' && <p className="text-xs text-red-500 mt-1">{item.error}</p>}
                                    </div>
                                </div>
                            ))}
                            </div>
                        )}
                    </ScrollArea>
                </CardContent>
            </Card>
        </main>
    </div>
  );
}
