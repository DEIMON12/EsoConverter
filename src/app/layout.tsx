import type {Metadata} from 'next';
// Fuente incluida en el paquete: la app no descarga nada de internet.
import '@fontsource-variable/inter';
import './globals.css';
import { ToasterWrapper } from "@/components/toaster-wrapper";

export const metadata: Metadata = {
  title: 'ESOConverter',
  description: 'Offline, multi-file image converter. Your files never leave your computer.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning={true}>
      <body className="font-body antialiased" suppressHydrationWarning>
        {children}
        <ToasterWrapper />
      </body>
    </html>
  );
}
