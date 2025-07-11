import type {Metadata} from 'next';
import './globals.css';
import { ToasterWrapper } from "@/components/toaster-wrapper";

export const metadata: Metadata = {
  title: 'ParaConverter',
  description: 'A multi-threaded file conversion utility for efficiently changing file types.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet"></link>
      </head>
      <body className="font-body antialiased">
        {children}
        <ToasterWrapper />
      </body>
    </html>
  );
}
