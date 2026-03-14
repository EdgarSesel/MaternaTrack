import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Provider auth handles /dashboard/** and /login
// Portal auth (/portal/**) is handled by the (app) layout's getPortalSession() check
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
