"use client";

import { ModalProvider } from "@/components/Modal";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ModalProvider>{children}</ModalProvider>;
}
