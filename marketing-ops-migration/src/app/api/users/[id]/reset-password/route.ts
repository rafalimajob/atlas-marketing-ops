import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { isSuperAdmin } from "@/lib/permissions";
import { generateTemporaryPassword } from "@/lib/password";
import { logHistory } from "@/lib/history";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Reset de senha sem depender de e-mail (não há fluxo de "esqueci minha
 * senha" self-service — ver docs/AUTENTICACAO_E_SEGURANCA.md): um admin gera
 * uma senha temporária aqui e repassa para o usuário por um canal fora do
 * sistema (telefone, presencial). A senha em texto puro só existe nesta
 * resposta — nunca é gravada nem logada em lugar nenhum.
 */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { session } = gate;

  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json({ error: "Você não pode redefinir a própria senha por aqui." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  if (isSuperAdmin(existing.role) && !isSuperAdmin(session.user.role)) {
    return NextResponse.json(
      { error: "Apenas o Super Administrador pode redefinir a senha de outro Super Administrador." },
      { status: 403 }
    );
  }

  const password = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id }, data: { passwordHash } });

  await logHistory({
    action: "UPDATE",
    entity: "USER",
    entityId: id,
    summary: `Senha de "${existing.email}" redefinida por um administrador`,
    userId: session.user.id,
  });

  return NextResponse.json({ password });
}
