import type { Metadata, Viewport } from "next";
import { Noto_Sans_Georgian } from "next/font/google";
import "./globals.css";

const font = Noto_Sans_Georgian({ subsets: ["georgian", "latin"], variable: "--font-ka" });

export const metadata: Metadata = {
  title: "პრეს ცენტრის მართვის ცენტრი",
  description: "გადაღებების დაგეგმვა და გუნდის კოორდინაცია",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ka">
      <body className={`${font.variable} antialiased`}>{children}</body>
    </html>
  );
}
