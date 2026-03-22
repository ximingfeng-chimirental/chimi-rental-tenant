import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chimi Rental Tenant",
  description: "Secure tenant portal for viewing charges and paying rent.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
