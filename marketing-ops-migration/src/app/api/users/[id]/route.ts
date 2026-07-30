import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, type UserRole, type UserStatus } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/require-admin";
import { isAdminRole, isSuperAdmin } from "@/lib/permissions";
import { logHistory, diffFields } from "@/lib/history";
import { toErrorResponse } from "@/lib/api-errors";
import type { UserDTO } from "@/types/user";

type RouteContext = { params: Promise<{ id: string }> };

const ROLE_VALUES: UserRole[] = ["SUPER_ADMIN", "ADMIN", "USER", "VIEWER"];
const STATUS_VALUES: UserStatus[] = ["PENDING", "ACTIVE", "DEACTIVATED"];

/** Impede remover o último ADMIN/SUPER_ADMIN ativo do sistema (por demoção,
 * desativação ou exclusão) — sem isso seria possível trancar o sistema
 * inteiro sem ninguém capaz de reverter. */
async function isLastActiveAdmin(existing: { id: string; role: UserRole; status: UserStatus }) {
  if (!isAdminRole(existing.role) || existing.status !== "ACTIVE") return false;
  const otherActiveAdmins = await prisma.user.count({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE", id: { not: existing.id } },
  });
  return otherActiveAdmins === 0;
}

async function wouldRemoveLastActiveAdmin(existing: { id: string; role: UserRole; status: UserStatus }, nextRole: UserRole, nextStatus: UserStatus) {
  const staysActiveAdmin = isAdminRole(nextRole) && nextStatus === "ACTIVE";
  if (staysActiveAdmin) return false;
  return isLastActiveAdmin(existing);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { session } = gate;

  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json({ error: "Você não pode alterar a própria conta por aqui." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  // Só um Super Administrador pode mexer na conta de outro Super
  // Administrador, ou conceder o papel de Super Administrador a alguém.
  if (isSuperAdmin(existing.role) && !isSuperAdmin(session.user.role)) {
    return NextResponse.json(
      { error: "Apenas o Super Administrador pode alterar a conta de outro Super Administrador." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const role = body?.role;
  const status = body?.status;
  if (role !== undefined && !ROLE_VALUES.includes(role)) {
    return NextResponse.json({ error: "Papel inválido." }, { status: 400 });
  }
  if (status !== undefined && !STATUS_VALUES.includes(status)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  const nextRole: UserRole = role ?? existing.role;
  const nextStatus: UserStatus = status ?? existing.status;

  if (nextRole === "SUPER_ADMIN" && !isSuperAdmin(session.user.role)) {
    return NextResponse.json(
      { error: "Apenas o Super Administrador pode conceder o papel de Super Administrador." },
      { status: 403 }
    );
  }

  if (await wouldRemoveLastActiveAdmin(existing, nextRole, nextStatus)) {
    return NextResponse.json({ error: "É necessário manter ao menos um administrador ativo." }, { status: 409 });
  }

  const user = await prisma.user.update({ where: { id }, data: { role: nextRole, status: nextStatus } });

  const changed = diffFields({ role: existing.role, status: existing.status }, { role: nextRole, status: nextStatus });
  if (Object.keys(changed).length > 0) {
    await logHistory({
      action: "UPDATE",
      entity: "USER",
      entityId: user.id,
      summary: `Usuário "${user.email}" atualizado (${Object.keys(changed).join(", ")})`,
      userId: session.user.id,
      diff: changed,
    });
  }

  const dto: UserDTO = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    mfaEnabled: user.mfaEnabled,
    createdAt: user.createdAt.toISOString(),
  };
  return NextResponse.json(dto);
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { session } = gate;

  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json({ error: "Você não pode excluir a própria conta." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  if (isSuperAdmin(existing.role) && !isSuperAdmin(session.user.role)) {
    return NextResponse.json(
      { error: "Apenas o Super Administrador pode excluir a conta de outro Super Administrador." },
      { status: 403 }
    );
  }

  if (await isLastActiveAdmin(existing)) {
    return NextResponse.json({ error: "É necessário manter ao menos um administrador ativo." }, { status: 409 });
  }

  try {
    await prisma.user.delete({ where: { id } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return NextResponse.json(
        { error: "Este usuário não pode ser excluído: existem registros de estoque, pedidos ou movimentações vinculados a ele. Desative o acesso em vez de excluir." },
        { status: 409 }
      );
    }
    const { message, status } = toErrorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }

  try {
    await logHistory({
      action: "DELETE",
      entity: "USER",
      entityId: id,
      summary: `Usuário "${existing.email}" excluído`,
      userId: session.user.id,
    });
  } catch (err) {
    console.error("Falha ao gravar HistoryLog:", err);
  }

  return NextResponse.json({ ok: true });
}
