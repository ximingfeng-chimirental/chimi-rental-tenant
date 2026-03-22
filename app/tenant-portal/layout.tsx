import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tenant Portal - Chimi Rental",
  description: "View your charges and manage payments securely.",
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
