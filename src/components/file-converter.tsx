
"use client";

import { useState, useRef, ChangeEvent, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UploadCloud, File, FileImage, FileText, History, Hexagon, X, Loader2, CheckCircle2, AlertTriangle, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { convertImage } from '@/ai/flows/convert-image-flow';

type ConversionStatus = 'queued' | 'converting' | 'completed' | 'error';

interface ConversionFile {
  id: string;
  file: File;
  status: ConversionStatus;
  progress: number;
  outputName: string;
}

interface LogEntry {
  id: number;
  message: string;
  timestamp: string;
  type: 'info' | 'error' | 'success';
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
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logIdCounter = useRef(0);
  const fileIdCounter = useRef(0);
  const { toast } = useToast();

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const newLog: LogEntry = {
      id: logIdCounter.current++,
      message,
      timestamp: new Date().toLocaleTimeString(),
      type,
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
       if (newFiles.length !== Array.from(files).length) {
        addLog("Some selected files were not images and have been ignored.", "info");
        toast({ title: "Non-image files ignored", description: "Only image files (PNG, JPEG, etc.) are supported for conversion." });
      }
      setSelectedFiles(prev => [...prev, ...newFiles]);
      addLog(`Selected ${newFiles.length} image file(s).`);
    }
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const removeSelectedFile = (index: number) => {
    const fileName = selectedFiles[index].name;
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    addLog(`Removed '${fileName}' from selection.`);
  };

  const handleConvertClick = async () => {
    if (selectedFiles.length === 0) {
      toast({ title: "No files selected", description: "Please select image files to convert.", variant: "destructive" });
      return;
    }

    setIsConverting(true);
    addLog(`Starting conversion for ${selectedFiles.length} file(s) to ${outputFormat.toUpperCase()}.`, 'success');

    const queue: ConversionFile[] = selectedFiles.map((file) => {
        const id = `${file.name}-${file.lastModified}-${fileIdCounter.current++}`;
        return {
          id,
          file,
          status: 'queued',
          progress: 0,
          outputName: `${file.name.split('.').slice(0, -1).join('.')}.${outputFormat}`,
        };
    });
    
    setConversionQueue(queue);
    setSelectedFiles([]);

    const conversionPromises = queue.map(item => performConversion(item));
    await Promise.allSettled(conversionPromises);

    addLog('All conversions finished.', 'success');
    setIsConverting(false);
  };
  
  const performConversion = async (item: ConversionFile) => {
    try {
      addLog(`Converting '${item.file.name}' to ${outputFormat.toUpperCase()}...`);
      setConversionQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'converting', progress: 25 } : q));

      const imageDataUri = await fileToDataUri(item.file);
      setConversionQueue(prev => prev.map(q => q.id === item.id ? { ...q, progress: 50 } : q));
      
      const result = await convertImage({ 
        imageDataUri, 
        outputFormat: outputFormat as any,
      });

      setConversionQueue(prev => prev.map(q => q.id === item.id ? { ...q, progress: 75 } : q));

      const a = document.createElement('a');
      a.href = result.convertedImageUri;
      a.download = item.outputName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      setConversionQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'completed', progress: 100 } : q));
      addLog(`Successfully converted and downloaded '${item.file.name}'.`, 'success');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      addLog(`Error converting '${item.file.name}': ${errorMessage}`, 'error');
      setConversionQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', progress: 0 } : q));
    }
  };

  const FileIcon = useMemo(() => ({ file }: { file: File }) => {
    if (file.type.startsWith('image/')) return <FileImage className="h-5 w-5 text-accent" />;
    return <File className="h-5 w-5 text-accent" />;
  }, []);

  const StatusIcon = useMemo(() => ({ status }: { status: ConversionStatus }) => {
    switch (status) {
        case 'converting': return <Loader2 className="h-5 w-5 animate-spin text-blue-400" />;
        case 'completed': return <CheckCircle2 className="h-5 w-5 text-green-400" />;
        case 'error': return <AlertTriangle className="h-5 w-5 text-red-400" />;
        default: return <History className="h-5 w-5 text-muted-foreground" />;
    }
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-8">
        <div className="flex items-center gap-4">
            <div className="bg-primary p-3 rounded-lg shadow-md">
                <Wand2 className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
                <h1 className="text-3xl font-bold font-headline text-primary-foreground/90">ParaConverter</h1>
                <p className="text-muted-foreground">Fast, AI-powered file conversion.</p>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-2 flex flex-col gap-8">
                <Card className="flex-grow">
                    <CardHeader>
                        <CardTitle>1. Select Images</CardTitle>
                        <CardDescription>Choose one or more images to convert.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Label htmlFor="file-upload" className="w-full cursor-pointer">
                            <div className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg border-border hover:bg-muted transition-colors">
                                <UploadCloud className="h-12 w-12 text-muted-foreground" />
                                <p className="mt-2 text-sm text-muted-foreground">
                                    <span className="font-semibold text-accent">Click to upload</span> or drag and drop
                                </p>
                                <p className="text-xs text-muted-foreground">PNG, JPG, WEBP supported</p>
                            </div>
                        </Label>
                        <input id="file-upload" ref={fileInputRef} type="file" className="hidden" multiple onChange={handleFileSelect} accept="image/*" />
                        
                        {selectedFiles.length > 0 && (
                            <div className="mt-4">
                                <h3 className="font-medium mb-2">Selected files:</h3>
                                <ScrollArea className="h-40 w-full rounded-md border p-2">
                                    {selectedFiles.map((file, index) => (
                                        <div key={index} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 text-sm">
                                            <div className="flex items-center gap-2 truncate">
                                                <FileIcon file={file} />
                                                <span className="truncate">{file.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className="text-muted-foreground">{formatBytes(file.size)}</span>
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
                        <CardTitle>2. Choose Format</CardTitle>
                        <CardDescription>Select the desired output format.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Select value={outputFormat} onValueChange={setOutputFormat}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select output format" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="png">PNG</SelectItem>
                                <SelectItem value="jpeg">JPEG</SelectItem>
                                <SelectItem value="webp">WEBP</SelectItem>
                            </SelectContent>
                        </Select>
                    </CardContent>
                    <CardFooter>
                         <Button onClick={handleConvertClick} disabled={isConverting || selectedFiles.length === 0} className="w-full bg-primary hover:bg-primary/90">
                            {isConverting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Converting...
                                </>
                            ) : (
                                "Convert Files"
                            )}
                        </Button>
                    </CardFooter>
                </Card>
            </div>

            <div className="lg:col-span-3 flex flex-col gap-8">
                <Card className="flex-grow">
                    <CardHeader>
                        <CardTitle>Conversion Progress</CardTitle>
                        <CardDescription>Track the progress of your file conversions.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className={cn("h-64", conversionQueue.length === 0 && "flex items-center justify-center")}>
                            {conversionQueue.length === 0 ? (
                                <p className="text-muted-foreground text-center">Your conversion queue is empty.</p>
                            ) : (
                                <div className="space-y-4">
                                {conversionQueue.map(item => (
                                    <div key={item.id} className="flex items-center gap-4">
                                        <StatusIcon status={item.status} />
                                        <div className="flex-grow">
                                            <div className="flex justify-between text-sm mb-1">
                                                <p className="truncate font-medium">{item.file.name}</p>
                                                <p className="text-muted-foreground flex-shrink-0">{item.status}</p>
                                            </div>
                                            <Progress value={item.progress} className={cn(item.status === 'error' && '[&>div]:bg-red-500')} />
                                        </div>
                                    </div>
                                ))}
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <History className="text-muted-foreground" />
                            <CardTitle>Conversion Log</CardTitle>
                        </div>
                        <CardDescription>Detailed log of all conversion activities.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-48">
                           <div className="space-y-3">
                            {logs.map(log => (
                                <div key={log.id} className="flex items-start gap-3 text-sm">
                                    <span className="font-mono text-muted-foreground/70">{log.timestamp}</span>
                                    <p className={cn(
                                        log.type === 'error' && 'text-red-400',
                                        log.type === 'success' && 'text-green-400'
                                    )}>
                                        {log.message}
                                    </p>
                                </div>
                            ))}
                           </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}
