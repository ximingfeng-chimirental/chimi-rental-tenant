"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LinkPortalClient() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function finishSignIn() {
      try {
        const res = await fetch("/api/tenant-portal/me", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load tenant portal");
        }
        if (!active) return;
        router.replace("/");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load tenant portal");
      }
    }

    void finishSignIn();

    return () => {
      active = false;
    };
  }, [router]);

  if (error) {
    return (
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#0f172a" }}>
          Couldn&apos;t open your portal
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
          {error}
        </p>
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
        Opening your tenant portal...
      </p>
    </div>
  );
}
