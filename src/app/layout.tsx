import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { Space_Grotesk } from 'next/font/google'
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'DictionDuel - Doğru Yazım Düellosu',
  description: 'Sıkça karıştırılan kelimelerle yazım bilginizi test edin!',
};

const font = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-body',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className={cn("font-body antialiased animated-gradient", font.variable)}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
