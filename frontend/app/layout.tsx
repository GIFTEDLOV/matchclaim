import type { Metadata } from "next";
import { AppShell } from "@/components/shell";
import { WalletProvider } from "@/components/wallet";
import "./globals.css";

export const metadata: Metadata = {
  title: "MatchClaim — price matching with accountable consensus",
  description: "A retailer price-match claim service powered by an authoritative GenLayer contract.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><WalletProvider><AppShell>{children}</AppShell></WalletProvider></body></html>;
}
