import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import Providers from "@/components/providers";
import { ErrorBoundary } from "@/components/error-boundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Receptionist - Never Miss a Call Again",
  description: "Deploy an AI receptionist that answers calls, responds to texts, and handles customer inquiries 24/7. Natural voice, instant setup, affordable pricing.",
  keywords: ["AI Receptionist", "Virtual Receptionist", "AI Phone Answering", "Business Phone AI", "Voice AI", "SMS Automation", "24/7 Receptionist"],
  openGraph: {
    title: "AI Receptionist - Never Miss a Call Again",
    description: "Deploy an AI receptionist that answers calls, responds to texts, and handles customer inquiries 24/7.",
    url: "https://ai-receptionist-saas-flame.vercel.app",
    siteName: "AI Receptionist",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Receptionist - Never Miss a Call Again",
    description: "Deploy an AI receptionist that answers calls, responds to texts, and handles customer inquiries 24/7.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
          <Toaster />
          <SonnerToaster position="top-center" richColors />
        </Providers>
      </body>
    </html>
  );
}
