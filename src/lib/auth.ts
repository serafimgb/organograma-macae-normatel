import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;

      const uid = (token.id ?? token.sub) as string | undefined;
      if (uid) {
        const dbUser = await db.user.findUnique({
          where: { id: uid },
          select: { role: true, status: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.status = dbUser.status;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = (token.id ?? token.sub) as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).role = (token.role as string) ?? "VIEWER";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).status = (token.status as string) ?? "PENDING";
      }
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: "ADMIN" | "MANAGER" | "VIEWER";
      status: "PENDING" | "APPROVED" | "REJECTED";
    };
  }
}
