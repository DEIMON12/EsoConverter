"use client";

import { useState, useRef, ChangeEvent, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UploadCloud, FileImage, X, Loader2, CheckCircle2, AlertTriangle, History, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { convertImage, ConvertImageInput } from '@/ai/flows/convert-image-flow';

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
          title: "Invalid files ignored", 
          description: "Only image files are supported for conversion.",
          variant: "destructive"
        });
      }
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const updateQueueItem = useCallback((id: string, updates: Partial<ConversionFile>) => {
    setConversionQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  }, []);

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
  }, [updateQueueItem]);

  const handleConvertClick = async () => {
    if (selectedFiles.length === 0) {
      toast({ title: "No files selected", description: "Please select images to convert.", variant: "destructive" });
      return;
    }

    setIsConverting(true);
    
    const newQueue: ConversionFile[] = selectedFiles.map((file, index) => ({
      id: `${file.name}-${file.lastModified}-${index}`,
      file,
      status: 'queued',
      progress: 0,
      outputName: `${file.name.split('.').slice(0, -1).join('.')}.${outputFormat}`,
    }));
    
    setConversionQueue(newQueue);
    setSelectedFiles([]);

    // Process up to 5 files concurrently
    const CONCURRENT_LIMIT = 5;
    const queueCopy = [...newQueue];
    
    const conversionPromises = new Array(CONCURRENT_LIMIT).fill(Promise.resolve()).map(() => {
        return new Promise<void>((resolve) => {
            const processNext = () => {
                const item = queueCopy.shift();
                if(!item) {
                    return resolve();
                }
                performConversion(item, outputFormat).finally(processNext);
            };
            processNext();
        });
    });

    await Promise.all(conversionPromises);
    
    setIsConverting(false);
    toast({ title: "All conversions finished", description: "All files have been processed." });
  };
  
  const StatusIcon = useMemo(() => ({ status }: { status: ConversionStatus }) => {
    switch (status) {
        case 'converting': return <Loader2 className="h-5 w-5 animate-spin text-accent" />;
        case 'completed': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
        case 'error': return <AlertTriangle className="h-5 w-5 text-destructive" />;
        default: return <History className="h-5 w-5 text-muted-foreground" />;
    }
  }, []);

  return (
    <>
      <header className="flex items-center gap-4 mb-8">
        <div className="bg-primary p-3 rounded-lg shadow-md">
          <Wand2 className="h-8 w-8 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">ParaConverter</h1>
          <p className="text-muted-foreground">Fast, multi-file conversion.</p>
        </div>
      </header>
      
      <main className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-2 flex flex-col gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">1. Select Files</CardTitle>
              <CardDescription>Drag or select images to convert.</CardDescription>
            </CardHeader>
            <CardContent>
              <Label htmlFor="file-upload" className="w-full cursor-pointer group">
                <div className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg border-border group-hover:border-primary transition-colors">
                  <UploadCloud className="h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-semibold text-primary">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">Supports PNG, JPG, WEBP</p>
                </div>
              </Label>
              <input id="file-upload" ref={fileInputRef} type="file" className="hidden" multiple onChange={handleFileSelect} accept="image/*" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">2. Configure & Convert</CardTitle>
              <CardDescription>Choose output format and start.</CardDescription>
            </CardHeader>
            <CardContent>
              <Label htmlFor="output-format">Output Format</Label>
              <Select value={outputFormat} onValueChange={setOutputFormat}>
                <SelectTrigger id="output-format">
                  <SelectValue placeholder="Select a format" />
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
                {isConverting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                {isConverting ? "Processing..." : `Convert ${selectedFiles.length} File(s)`}
              </Button>
            </CardFooter>
          </Card>
        </div>

        <Card className="lg:col-span-3 flex flex-col">
          <CardHeader>
            <CardTitle>Conversion Progress</CardTitle>
            <CardDescription>Track the status of your files.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <ScrollArea className={cn("h-80", conversionQueue.length === 0 && "flex items-center justify-center")}>
              {conversionQueue.length === 0 ? (
                <div className="text-center text-muted-foreground">
                  <p>Conversion queue is empty.</p>
                  <p className="text-xs mt-1">Upload files to begin.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedFiles.length > 0 && (
                     <div className="text-sm text-muted-foreground p-2 border-l-2 border-primary">
                        {selectedFiles.length} file(s) ready. Click Convert to start.
                     </div>
                  )}
                  {conversionQueue.map(item => (
                    <div key={item.id} className="flex items-center gap-4 p-2 rounded-lg bg-muted/30">
                      <StatusIcon status={item.status} />
                      <div className="flex-grow">
                        <div className="flex justify-between text-sm mb-1 items-center">
                          <p className="truncate font-medium max-w-[150px] sm:max-w-[250px]">{item.file.name}</p>
                          <p className="text-muted-foreground flex-shrink-0 capitalize text-xs">{item.status}</p>
                        </div>
                        <Progress value={item.progress} className={cn('h-2', item.status === 'error' && '[&>div]:bg-destructive')} />
                        {item.status === 'error' && <p className="text-xs text-destructive mt-1 truncate">{item.error}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
