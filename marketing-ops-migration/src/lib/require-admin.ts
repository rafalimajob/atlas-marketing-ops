import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminRole, isSuperAdmin } from "@/lib/permissions";

type Gate = { session: Session } | { error: NextResponse };

/** Gate para as ações de administração (editar/excluir movimentações, kits,
 * retiradas de área, gerenciar usuários) — ADMIN e SUPER_ADMIN têm o mesmo
 * acesso aqui; SUPER_ADMIN só se distingue nas ações de `requireSuperAdmin()`. */
export async function requireAdmin(): Promise<Gate> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }
  if (!isAdminRole(session.user.role)) {
    return { error: NextResponse.json({ error: "Apenas administradores podem acessar este recurso." }, { status: 403 }) };
  }
  return { session };
}

/** Gate exclusivo do Super Administrador — conceder/revogar SUPER_ADMIN e
 * editar a conta de outro SUPER_ADMIN. */
export async function requireSuperAdmin(): Promise<Gate> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }
  if (!isSuperAdmin(session.user.role)) {
    return { error: NextResponse.json({ error: "Apenas o Super Administrador pode realizar esta ação." }, { status: 403 }) };
  }
  return { session };
}

/** Gate para qualquer criação/edição/exclusão "comum" (pedidos, movimentações,
 * estoque, kits, retiradas, categorias, áreas) — todo mundo além do VIEWER
 * pode escrever; só o VIEWER é somente leitura. */
export async function requireWriteAccess(): Promise<Gate> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }
  if (session.user.role === "VIEWER") {
    return { error: NextResponse.json({ error: "Visualizadores não podem criar, editar ou excluir registros." }, { status: 403 }) };
  }
  return { session };
}
