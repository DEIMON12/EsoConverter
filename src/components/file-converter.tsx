"use client";

import { useState, useRef, ChangeEvent, DragEvent, useMemo, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UploadCloud, FileImage, X, Loader2, CheckCircle2, AlertTriangle, History, Wand2, FolderOpen, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { convertImage, outputName, OutputFormat } from '@/lib/convert-image';
import { saveOutput, desktop } from '@/lib/save-output';

type ConversionStatus = 'queued' | 'converting' | 'completed' | 'error';

interface ConversionFile {
  id: string;
  file: File;
  status: ConversionStatus;
  progress: number;
  outputName: string;
  error?: string;
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Conversiones en paralelo. Cada una ocupa memoria con la imagen decodificada.
const CONCURRENT_LIMIT = 4;

export function FileConverter() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [conversionQueue, setConversionQueue] = useState<ConversionFile[]>([]);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('png');
  const [quality, setQuality] = useState<number>(92);
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isDesktop, setIsDesktop] = useState<boolean>(false);
  const [outputFolder, setOutputFolder] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const api = desktop();
    if (api) {
      setIsDesktop(true);
      api.getOutputFolder().then(setOutputFolder).catch(() => {});
    }
  }, []);

  const addFiles = useCallback((files: File[]) => {
    const images = files.filter(file => file.type.startsWith('image/'));
    if (images.length !== files.length) {
      toast({
        title: "Invalid files ignored",
        description: "Only image files are supported for conversion.",
        variant: "destructive"
      });
    }
    setSelectedFiles(prev => [...prev, ...images]);
  }, [toast]);

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addFiles(Array.from(event.target.files));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const chooseFolder = async () => {
    const folder = await desktop()?.chooseOutputFolder();
    if (folder) setOutputFolder(folder);
  };

  const updateQueueItem = useCallback((id: string, updates: Partial<ConversionFile>) => {
    setConversionQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  }, []);

  const performConversion = useCallback(async (item: ConversionFile, format: OutputFormat, q: number) => {
    updateQueueItem(item.id, { status: 'converting', progress: 25 });
    try {
      const blob = await convertImage(item.file, format, { quality: q / 100 });
      updateQueueItem(item.id, { progress: 75 });
      await saveOutput(blob, item.outputName);
      updateQueueItem(item.id, { status: 'completed', progress: 100 });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown conversion error occurred';
      updateQueueItem(item.id, { status: 'error', progress: 0, error: errorMessage });
      toast({
        title: `Error converting '${item.file.name}'`,
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [updateQueueItem, toast]);

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
      outputName: outputName(file.name, outputFormat),
    }));

    setConversionQueue(newQueue);
    setSelectedFiles([]);

    const pending = [...newQueue];
    const worker = async () => {
      for (let item = pending.shift(); item; item = pending.shift()) {
        await performConversion(item, outputFormat, quality);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENT_LIMIT }, worker));

    setIsConverting(false);
    toast({
      title: "All conversions finished",
      description: isDesktop ? `Saved to ${outputFolder}` : "All files have been processed.",
    });
  };

  const StatusIcon = useMemo(() => ({ status }: { status: ConversionStatus }) => {
    switch (status) {
      case 'converting': return <Loader2 className="h-5 w-5 animate-spin text-accent" />;
      case 'completed': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error': return <AlertTriangle className="h-5 w-5 text-destructive" />;
      default: return <History className="h-5 w-5 text-muted-foreground" />;
    }
  }, []);

  const hasFiles = selectedFiles.length > 0 || conversionQueue.length > 0;
  const lossy = outputFormat !== 'png';

  return (
    <>
      <header className="flex items-center gap-4 mb-8">
        <div className="bg-primary p-3 rounded-lg shadow-md">
          <Wand2 className="h-8 w-8 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">ESOConverter</h1>
          <p className="text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-accent" />
            Fast, multi-file conversion. Your files never leave your computer.
          </p>
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
              <Label
                htmlFor="file-upload"
                className="w-full cursor-pointer group"
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <div className={cn(
                  "flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg border-border group-hover:border-primary transition-colors",
                  isDragging && "border-primary bg-primary/10"
                )}>
                  <UploadCloud className="h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-semibold text-primary">Click to select</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, WEBP, GIF, BMP, AVIF, ICO</p>
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
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="output-format">Output Format</Label>
                <Select value={outputFormat} onValueChange={(v) => setOutputFormat(v as OutputFormat)}>
                  <SelectTrigger id="output-format">
                    <SelectValue placeholder="Select a format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="png">PNG</SelectItem>
                    <SelectItem value="jpeg">JPEG</SelectItem>
                    <SelectItem value="webp">WEBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className={cn("space-y-2", !lossy && "opacity-50")}>
                <div className="flex justify-between">
                  <Label htmlFor="quality">Quality</Label>
                  <span className="text-sm text-muted-foreground">{lossy ? `${quality}%` : 'Lossless'}</span>
                </div>
                <Slider id="quality" min={10} max={100} step={1} value={[quality]} onValueChange={([v]) => setQuality(v)} disabled={!lossy} />
              </div>

              {isDesktop && (
                <div className="space-y-2">
                  <Label>Output Folder</Label>
                  <div className="flex gap-2">
                    <p className="flex-grow truncate rounded-md border border-input px-3 py-2 text-sm text-muted-foreground" title={outputFolder}>
                      {outputFolder || '…'}
                    </p>
                    <Button variant="outline" onClick={chooseFolder} disabled={isConverting}>Change</Button>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button onClick={handleConvertClick} disabled={isConverting || selectedFiles.length === 0} className="w-full">
                {isConverting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                {isConverting ? "Processing..." : `Convert ${selectedFiles.length} File(s)`}
              </Button>
              {isDesktop && (
                <Button variant="ghost" className="w-full" onClick={() => desktop()?.openOutputFolder()}>
                  <FolderOpen className="mr-2 h-4 w-4" /> Open Output Folder
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>

        <Card className="lg:col-span-3 flex flex-col">
          <CardHeader>
            <CardTitle>Conversion Queue</CardTitle>
            <CardDescription>Track the status of your files.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <ScrollArea className={cn("h-80", !hasFiles && "flex items-center justify-center")}>
              {!hasFiles ? (
                <div className="text-center text-muted-foreground">
                  <p>No files selected.</p>
                  <p className="text-xs mt-1">Add files to begin.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedFiles.length > 0 && (
                    <>
                      <h4 className="text-sm font-medium text-muted-foreground px-2">Ready to Convert ({selectedFiles.length})</h4>
                      {selectedFiles.map((file, index) => (
                        <div key={`${file.name}-${index}`} className="flex items-center gap-4 p-2 rounded-lg bg-muted/30">
                          <FileImage className="h-5 w-5 text-primary" />
                          <div className="flex-grow">
                            <p className="truncate font-medium text-sm max-w-[200px] sm:max-w-[300px]">{file.name}</p>
                            <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeSelectedFile(index)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </>
                  )}
                  {conversionQueue.length > 0 && (
                    <>
                      {selectedFiles.length > 0 && <hr className="border-border my-4" />}
                      <h4 className="text-sm font-medium text-muted-foreground px-2">Conversion Progress</h4>
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
                    </>
                  )}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
