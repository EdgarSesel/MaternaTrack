import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { portalAuthConfig } from "@/lib/portal-auth.config";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const {
  handlers: portalHandlers,
  auth: portalAuth,
  signIn: portalSignIn,
  signOut: portalSignOut,
} = NextAuth({
  ...portalAuthConfig,
  providers: [
    Credentials({
      name: "portal-credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const portalUser = await db.patientUser.findUnique({
          where: { email },
          include: { patient: { select: { id: true, firstName: true, lastName: true } } },
        });

        if (!portalUser) return null;

        const isValid = await bcrypt.compare(password, portalUser.passwordHash);
        if (!isValid) return null;

        // Update last login
        await db.patientUser.update({
          where: { id: portalUser.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: portalUser.id,
          email: portalUser.email,
          name: `${portalUser.patient.firstName} ${portalUser.patient.lastName}`,
          patientId: portalUser.patientId,
        };
      },
    }),
  ],
});
