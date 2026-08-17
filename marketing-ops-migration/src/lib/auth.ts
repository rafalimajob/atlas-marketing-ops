import type { NextAuthOptions, User as NextAuthUser } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyTicket } from "@/lib/tickets";
import { decryptMfaSecret, verifyTotpCode, consumeBackupCode } from "@/lib/mfa";
import type { User, UserRole } from "@/generated/prisma/client";

function toSessionUser(user: User): NextAuthUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role } as NextAuthUser;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        ticket: { label: "ticket", type: "text" },
        totpCode: { label: "totpCode", type: "text" },
        backupCode: { label: "backupCode", type: "text" },
      },
      async authorize(credentials) {
        const ticket = credentials?.ticket;
        if (!ticket) return null;

        // Ticket emitido logo após o 1º código TOTP ser validado no setup do MFA:
        // a posse do autenticador já foi comprovada, não é preciso pedir código de novo.
        const verified = verifyTicket(ticket, "mfa-verified");
        if (verified) {
          const user = await prisma.user.findUnique({ where: { id: verified.userId } });
          if (!user || !user.mfaEnabled || user.status !== "ACTIVE") return null;
          return toSessionUser(user);
        }

        // Ticket emitido pelo precheck quando o cookie de "confiar neste navegador" (30 dias)
        // já comprovou a posse do 2º fator antes — pula o TOTP desta vez.
        const trusted = verifyTicket(ticket, "trusted-device-login");
        if (trusted) {
          const user = await prisma.user.findUnique({ where: { id: trusted.userId } });
          if (!user || !user.mfaEnabled || user.status !== "ACTIVE") return null;
          return toSessionUser(user);
        }

        // Login normal (usuário já tem MFA configurado): exige TOTP ou backup code.
        const challenge = verifyTicket(ticket, "mfa-challenge");
        if (!challenge) return null;

        const user = await prisma.user.findUnique({ where: { id: challenge.userId } });
        if (!user || !user.mfaEnabled || !user.mfaSecret || user.status !== "ACTIVE") return null;

        if (credentials?.totpCode) {
          const plainSecret = decryptMfaSecret(user.mfaSecret);
          const ok = await verifyTotpCode(plainSecret, credentials.totpCode);
          if (!ok) return null;
        } else if (credentials?.backupCode) {
          const { valid, consumedHash } = await consumeBackupCode(credentials.backupCode, user.mfaBackupCodes);
          if (!valid || !consumedHash) return null;
          await prisma.user.update({
            where: { id: user.id },
            data: { mfaBackupCodes: user.mfaBackupCodes.filter((h) => h !== consumedHash) },
          });
        } else {
          return null;
        }

        return toSessionUser(user);
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as NextAuthUser & { role: UserRole }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
};
