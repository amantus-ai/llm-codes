import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Apple Docs to Markdown Converter | LLM.codes',
  description:
    'Convert Apple Developer documentation to clean, LLM-friendly Markdown format. Process SwiftUI, UIKit, AppKit docs with smart filtering, deduplication, and bulk export. Free tool by @steipete.',
  keywords:
    'Apple documentation, Markdown converter, SwiftUI docs, UIKit documentation, AppKit docs, developer tools, documentation export, LLM training data, AI-friendly docs, Apple Developer, iOS documentation, macOS documentation, Swift documentation',
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
    title: 'Apple Docs to Markdown Converter',
    description:
      'Convert Apple Developer documentation to clean, LLM-friendly Markdown. Free tool with smart filtering and bulk export.',
    url: 'https://llm.codes',
    siteName: 'LLM.codes',
    images: [
      {
        url: 'https://llm.codes/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Apple Docs to Markdown Converter - Transform Apple Developer documentation',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Apple Docs to Markdown Converter',
    description:
      'Convert Apple Developer documentation to clean, LLM-friendly Markdown. Free tool by @steipete.',
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
