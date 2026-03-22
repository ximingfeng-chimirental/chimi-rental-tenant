import Link from "next/link";
import { auth0 } from "@/app/lib/auth0";
import LinkPortalClient from "@/app/tenant-portal/[token]/LinkPortalClient";

export default async function TenantInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await params;
  const session = await auth0.getSession();
  const loginHref = "/api/auth/login?returnTo=%2F";

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        padding: 24,
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 560,
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 24,
          padding: 32,
          boxShadow: "0 20px 60px rgba(15, 23, 42, 0.08)",
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: "0 0 10px",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#2563eb",
          }}
        >
          Chimi Rental
        </p>
        <h1 style={{ margin: "0 0 12px", fontSize: 30, lineHeight: 1.1, color: "#0f172a" }}>
          Tenant portal access
        </h1>
        <p style={{ margin: "0 0 24px", fontSize: 15, lineHeight: 1.6, color: "#475569" }}>
          Sign in with Auth0 to access your rent charges and payment history securely.
        </p>
        {session?.user ? (
          <LinkPortalClient />
        ) : (
          <Link
            href={loginHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "12px 18px",
              borderRadius: 10,
              background: "#2563eb",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Sign in to continue
          </Link>
        )}
      </section>
    </main>
  );
}
