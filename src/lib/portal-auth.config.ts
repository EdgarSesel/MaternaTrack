import type { NextAuthConfig } from "next-auth";

export const portalAuthConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  basePath: "/portal/api/auth",
  pages: {
    signIn: "/portal/login",
  },
  // Use a distinct cookie so portal and provider sessions don't collide
  cookies: {
    sessionToken: {
      name: "portal.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      const isPortal = pathname.startsWith("/portal");
      const isPortalLogin = pathname.startsWith("/portal/login");

      if (isPortal && !isPortalLogin && !isLoggedIn) return false;
      if (isPortalLogin && isLoggedIn) {
        return Response.redirect(new URL("/portal/dashboard", request.nextUrl));
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.patientId = (user as { patientId?: string }).patientId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session.user as { patientId?: string }).patientId = token.patientId as string;
      }
      return session;
    },
  },
};
