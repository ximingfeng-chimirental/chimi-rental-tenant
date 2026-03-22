import { auth0 } from "@/app/lib/auth0";

export const GET = (req: Request) => auth0.middleware(req);
