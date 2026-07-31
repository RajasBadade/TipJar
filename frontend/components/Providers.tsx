"use client";

import { ReactNode } from "react";
import { StellarProvider } from "@/components/StellarProvider";

export function Providers({ children }: { children: ReactNode }) {
  return <StellarProvider>{children}</StellarProvider>;
}
