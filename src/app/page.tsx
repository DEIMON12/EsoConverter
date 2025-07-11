import { FileConverter } from '@/components/file-converter';

export default function Home() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl">
        <FileConverter />
      </div>
    </main>
  );
}
