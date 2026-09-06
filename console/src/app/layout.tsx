import type { Metadata } from "next";
import "@/styles/globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "InferencePort AI Developer Console",
  description: "Pay-2-Go API dashboard for InferencePort AI",
  icons: { icon: "/assets/logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}