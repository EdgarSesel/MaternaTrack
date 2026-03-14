import type { NextAuthConfig } from "next-auth";
import type { ProviderRole } from "@/generated/prisma/client";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8-hour sessions
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      const isDashboard = pathname.startsWith("/dashboard");

      // Unauthenticated users can't access dashboard
      if (isDashboard && !isLoggedIn) return false;

      // Admin-only routes
      if (pathname.startsWith("/dashboard/admin") && auth?.user) {
        const role = (auth.user as { role?: string }).role;
        if (role !== "ADMIN") {
          return Response.redirect(new URL("/dashboard", request.nextUrl));
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as ProviderRole;
      }
      return session;
    },
  },
};
