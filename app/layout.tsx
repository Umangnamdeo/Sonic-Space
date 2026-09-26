import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SonicSpace — Shape Sound. Feel Space.',
  description: 'Professional browser-native spatial audio workstation and acoustics processor. Shape sound, sculpt 3D soundfields, and master audio with zero latency.',
  openGraph: {
    title: 'SonicSpace — Shape Sound. Feel Space.',
    description: 'Professional browser-native spatial audio workstation and acoustics processor.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SonicSpace — Shape Sound. Feel Space.',
    description: 'Professional browser-native spatial audio workstation and acoustics processor.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#090b0e] text-[#d1d5db] min-h-screen antialiased selection:bg-cyan-500/20 selection:text-cyan-200" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
