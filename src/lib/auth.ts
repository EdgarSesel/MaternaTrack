import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { authConfig } from "@/lib/auth.config";
import {
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginFailures,
} from "@/lib/rate-limiter";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // Rate limit by email to prevent credential stuffing
        if (!checkLoginRateLimit(email)) return null;

        const provider = await db.provider.findUnique({
          where: { email },
        });

        if (!provider) {
          recordLoginFailure(email);
          return null;
        }

        const isValid = await bcrypt.compare(password, provider.passwordHash);
        if (!isValid) {
          recordLoginFailure(email);
          return null;
        }

        clearLoginFailures(email);

        return {
          id: provider.id,
          email: provider.email,
          name: provider.name,
          role: provider.role,
        };
      },
    }),
  ],
});
