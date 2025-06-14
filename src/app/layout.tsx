import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Web Documentation to Markdown Converter | LLM.codes',
  description:
    'Convert technical documentation from 69+ major sites to clean, LLM-friendly Markdown format. Support for programming languages, frameworks, cloud platforms, databases, and more. Free tool by @steipete.',
  keywords:
    'documentation converter, Markdown converter, API documentation, developer tools, React docs, Python docs, AWS documentation, TypeScript docs, documentation export, LLM training data, AI-friendly docs, technical documentation, programming documentation',
  authors: [{ name: 'Peter Steinberger', url: 'https://steipete.com' }],
  creator: 'Peter Steinberger',
  publisher: 'Peter Steinberger',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'Web Documentation to Markdown Converter',
    description:
      'Convert documentation from 69+ technical sites to clean, LLM-friendly Markdown. Support for programming languages, frameworks, cloud platforms, and more.',
    url: 'https://llm.codes',
    siteName: 'LLM.codes',
    images: [
      {
        url: 'https://llm.codes/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Web Documentation to Markdown Converter - Transform technical documentation',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Web Documentation to Markdown Converter',
    description:
      'Convert documentation from 69+ technical sites to clean, LLM-friendly Markdown. Free tool by @steipete.',
    creator: '@steipete',
    images: ['https://llm.codes/og-image.png'],
  },
  alternates: {
    canonical: 'https://llm.codes',
  },
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
    shortcut: '/logo.png',
  },
  manifest: '/manifest.json',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
  },
  category: 'technology',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
