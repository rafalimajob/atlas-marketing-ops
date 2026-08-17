import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { isSuperAdmin } from "@/lib/permissions";
import { logHistory } from "@/lib/history";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Reset de MFA para quem perdeu o autenticador e os backup codes ao mesmo
 * tempo (o único jeito de recuperar acesso hoje, já que não há fluxo
 * self-service — confirmar identidade sem senha nem MFA não daria pra fazer
 * com segurança sem e-mail configurado). Zera o MFA por completo; no próximo
 * login o usuário passa pelo fluxo de configuração inicial de novo (QR code
 * e backup codes novos) — ver `POST /api/auth/login/precheck`.
 */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { session } = gate;

  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json({ error: "Você não pode resetar o próprio MFA por aqui." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  if (isSuperAdmin(existing.role) && !isSuperAdmin(session.user.role)) {
    return NextResponse.json(
      { error: "Apenas o Super Administrador pode resetar o MFA de outro Super Administrador." },
      { status: 403 }
    );
  }

  if (!existing.mfaEnabled) {
    return NextResponse.json({ error: "Este usuário ainda não configurou o MFA." }, { status: 409 });
  }

  await prisma.user.update({
    where: { id },
    data: { mfaEnabled: false, mfaSecret: null, mfaBackupCodes: [] },
  });

  await logHistory({
    action: "UPDATE",
    entity: "USER",
    entityId: id,
    summary: `MFA de "${existing.email}" resetado por um administrador`,
    userId: session.user.id,
  });

  return NextResponse.json({ ok: true });
}
