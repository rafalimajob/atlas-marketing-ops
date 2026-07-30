import type { UserRole } from "@/generated/prisma/client";

// Sem import de prisma/servidor — pode ser usado tanto em Server quanto em
// Client Components (mesmo padrão de movement-types.ts/order-status.ts).

export const ROLE_VALUES: UserRole[] = ["SUPER_ADMIN", "ADMIN", "USER", "VIEWER"];

export const ROLE_LABEL: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Administrador",
  ADMIN: "Administrador",
  USER: "Usuário",
  VIEWER: "Visualizador",
};

export const ROLE_DESCRIPTION: Record<UserRole, string> = {
  SUPER_ADMIN: "Acesso total, incluindo conceder/revogar outros Super Administradores.",
  ADMIN: "Edita e exclui movimentações, kits e retiradas, e gerencia usuários (exceto Super Administradores).",
  USER: "Opera o dia a dia: cria pedidos, movimentações, itens de estoque, kits e retiradas.",
  VIEWER: "Somente leitura — vê todas as telas, mas não pode criar, editar ou excluir nada.",
};

/** ADMIN e SUPER_ADMIN têm as mesmas permissões de administração (editar/excluir
 * movimentações, kits, retiradas de área, acessar Usuários) — SUPER_ADMIN é um
 * superconjunto que também pode mexer em outros SUPER_ADMIN. */
export function isAdminRole(role: UserRole): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export function isSuperAdmin(role: UserRole): boolean {
  return role === "SUPER_ADMIN";
}

/** VIEWER é o único papel sem permissão de escrita — todos os outros podem
 * criar/editar dentro do que já lhes é permitido. */
export function canWrite(role: UserRole): boolean {
  return role !== "VIEWER";
}
