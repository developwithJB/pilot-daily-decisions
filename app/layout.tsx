import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const image = `${origin}/og.png`;
  const description = "pilot brings your apps, weather, Calendar, location, physical world, routines, and preferences into one portable second brain for daily decisions.";
  return {
    metadataBase: new URL(origin),
    title:"pilot: life’s daily decisions on autopilot", description,
    applicationName:"pilot",
    category:"lifestyle",
    alternates:{ canonical:"/" },
    icons:{ icon:"/favicon.svg", shortcut:"/favicon.svg" },
    openGraph:{ title:"pilot: life’s daily decisions on autopilot", siteName:"pilot", description, type:"website", url:"/", images:[{ url:image, width:1200, height:630, alt:"pilot: life’s daily decisions on autopilot" }] },
    twitter:{ card:"summary_large_image", title:"pilot: life’s daily decisions on autopilot", description, images:[image] },
    other:{ "theme-color":"#f4f0e7" },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
