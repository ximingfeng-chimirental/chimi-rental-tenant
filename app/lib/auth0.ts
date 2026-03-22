import { NextResponse } from "next/server";
import { Auth0Client } from "@auth0/nextjs-auth0/server";

const issuerBaseUrl = process.env.AUTH0_ISSUER_BASE_URL || "";
const domain = issuerBaseUrl.replace(/^https?:\/\//, "");
const appBaseUrl = process.env.AUTH0_BASE_URL || "";

export const auth0 = new Auth0Client({
  domain,
  appBaseUrl,
  routes: {
    login: "/api/auth/login",
    callback: "/api/auth/callback",
    logout: "/api/auth/logout",
  },
  authorizationParameters: {
    scope: process.env.AUTH0_SCOPE || "openid profile email",
    audience: process.env.AUTH0_AUDIENCE,
  },
  onCallback: async (error, ctx) => {
    const returnTo = ctx.returnTo || "/";
    const url = returnTo.startsWith("http")
      ? returnTo
      : new URL(returnTo, appBaseUrl || "http://localhost:3000").toString();
    if (error) {
      return NextResponse.redirect(new URL("/", url));
    }
    return NextResponse.redirect(url);
  },
});
