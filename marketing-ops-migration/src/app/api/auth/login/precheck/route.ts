import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { issueTicket, verifyTicket, TRUSTED_DEVICE_COOKIE } from "@/lib/tickets";

// Hash "dummy" usado para manter o tempo de resposta parecido quando o e-mail
// não existe, evitando que a latência revele se uma conta existe ou não.
const DUMMY_HASH = "$2b$12$CwTycUXWue0Thq9StjUM0uJ8Y5R6qgB1XyPB3aMh2ipS7z6zXqej.";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "E-mail e senha são obrigatórios." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !passwordOk) {
    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }

  if (user.status === "PENDING") {
    return NextResponse.json(
      { error: "Seu cadastro está aguardando aprovação de um administrador." },
      { status: 403 }
    );
  }

  if (user.status === "DEACTIVATED") {
    return NextResponse.json(
      { error: "Sua conta foi desativada. Entre em contato com um administrador." },
      { status: 403 }
    );
  }

  if (user.mfaEnabled) {
    const trustCookie = request.cookies.get(TRUSTED_DEVICE_COOKIE)?.value;
    const trusted = trustCookie ? verifyTicket(trustCookie, "trusted-device") : null;
    if (trusted && trusted.userId === user.id) {
      const ticket = issueTicket("trusted-device-login", user.id, user.email);
      return NextResponse.json({ mfaEnabled: true, trustedDevice: true, ticket });
    }

    const ticket = issueTicket("mfa-challenge", user.id, user.email);
    return NextResponse.json({ mfaEnabled: true, ticket });
  }

  const ticket = issueTicket("mfa-setup-bootstrap", user.id, user.email);
  return NextResponse.json({ mfaEnabled: false, ticket });
}
