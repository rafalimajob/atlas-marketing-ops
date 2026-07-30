"use client";

import { useState } from "react";
import { UserCheck, UserX, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { ErrorBanner } from "@/components/ui/error-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CHART_COLORS } from "@/lib/theme-colors";
import { ROLE_LABEL, ROLE_VALUES, isSuperAdmin } from "@/lib/permissions";
import type { UserDTO } from "@/types/user";
import type { UserRole, UserStatus } from "@/generated/prisma/client";

const STATUS_LABEL: Record<UserStatus, string> = {
  PENDING: "Aguardando aprovação",
  ACTIVE: "Ativo",
  DEACTIVATED: "Desativado",
};

const STATUS_COLOR: Record<UserStatus, string> = {
  PENDING: CHART_COLORS.warn,
  ACTIVE: CHART_COLORS.ok,
  DEACTIVATED: CHART_COLORS.crit,
};

const ROLE_COLOR: Record<UserRole, string> = {
  SUPER_ADMIN: CHART_COLORS.crit,
  ADMIN: CHART_COLORS.purple,
  USER: CHART_COLORS.slate,
  VIEWER: CHART_COLORS.accent,
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

interface PendingAction {
  user: UserDTO;
  title: string;
  message: string;
  confirmLabel: string;
  run: () => Promise<void>;
}

export function UserManagementView({
  initialUsers,
  currentUserId,
  currentUserRole,
}: {
  initialUsers: UserDTO[];
  currentUserId: string;
  currentUserRole: UserRole;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  // Só um Super Administrador pode conceder o papel de Super Administrador
  // (ou mexer na conta de outro) — mesma regra do servidor em /api/users/[id].
  const actorIsSuperAdmin = isSuperAdmin(currentUserRole);
  const assignableRoles = actorIsSuperAdmin ? ROLE_VALUES : ROLE_VALUES.filter((r) => r !== "SUPER_ADMIN");

  async function patchUser(id: string, body: { role?: UserRole; status?: UserStatus }) {
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível atualizar o usuário.");
      setUsers((prev) => prev.map((u) => (u.id === id ? data : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteUser(id: string) {
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível excluir o usuário.");
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmPendingAction() {
    if (!pendingAction) return;
    await pendingAction.run();
    setPendingAction(null);
  }

  function askApprove(u: UserDTO) {
    setPendingAction({
      user: u,
      title: "Aprovar acesso",
      message: `Aprovar o acesso de "${u.name}" (${u.email})? Ele passará a conseguir entrar no sistema normalmente.`,
      confirmLabel: "Aprovar",
      run: () => patchUser(u.id, { status: "ACTIVE" }),
    });
  }

  function askDeactivate(u: UserDTO) {
    setPendingAction({
      user: u,
      title: "Desativar acesso",
      message: `Desativar o acesso de "${u.name}" (${u.email})? Ele não conseguirá mais entrar no sistema até ser reativado.`,
      confirmLabel: "Desativar",
      run: () => patchUser(u.id, { status: "DEACTIVATED" }),
    });
  }

  function askReactivate(u: UserDTO) {
    setPendingAction({
      user: u,
      title: "Reativar acesso",
      message: `Reativar o acesso de "${u.name}" (${u.email})? Ele voltará a conseguir entrar no sistema.`,
      confirmLabel: "Reativar",
      run: () => patchUser(u.id, { status: "ACTIVE" }),
    });
  }

  function askChangeRole(u: UserDTO, nextRole: UserRole) {
    if (nextRole === u.role) return;
    setPendingAction({
      user: u,
      title: "Alterar papel",
      message: `Alterar o papel de "${u.name}" (${u.email}) de ${ROLE_LABEL[u.role]} para ${ROLE_LABEL[nextRole]}?`,
      confirmLabel: "Alterar",
      run: () => patchUser(u.id, { role: nextRole }),
    });
  }

  function askDelete(u: UserDTO) {
    setPendingAction({
      user: u,
      title: "Excluir usuário",
      message: `Excluir "${u.name}" (${u.email})? Se ele já tiver registros de estoque, pedidos ou movimentações, a exclusão será bloqueada — desative o acesso nesse caso.`,
      confirmLabel: "Excluir",
      run: () => deleteUser(u.id),
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Usuários" description="Aprovação, permissões e acesso de usuários do sistema" />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <Card className={users.length === 0 ? "" : "overflow-x-auto p-0"}>
        {users.length === 0 ? (
          <EmptyState message="Nenhum usuário cadastrado." />
        ) : (
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900/60">
            <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">Papel</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">MFA</th>
                <th className="px-4 py-3 font-medium">Cadastrado em</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                const busy = busyId === u.id;
                // ADMIN não pode mexer na conta de um SUPER_ADMIN nem na
                // própria — mesma regra aplicada em /api/users/[id].
                const lockedForActor = isSuperAdmin(u.role) && !actorIsSuperAdmin;
                const canManage = !isSelf && !lockedForActor;
                return (
                  <tr
                    key={u.id}
                    className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900/40"
                  >
                    <td className="px-4 py-3 text-zinc-800 dark:text-zinc-100">
                      {u.name} {isSelf && <span className="text-xs text-zinc-400">(você)</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{u.email}</td>
                    <td className="px-4 py-3">
                      {canManage ? (
                        <Select
                          value={u.role}
                          disabled={busy}
                          onChange={(e) => askChangeRole(u, e.target.value as UserRole)}
                          className="h-8 w-48 px-2 py-1 text-xs"
                        >
                          {assignableRoles.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Badge color={ROLE_COLOR[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={STATUS_COLOR[u.status]}>{STATUS_LABEL[u.status]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{u.mfaEnabled ? "Configurado" : "—"}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{fmtDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      {!canManage ? (
                        <span className="text-xs text-zinc-400">—</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          {u.status === "PENDING" && (
                            <button
                              type="button"
                              title="Aprovar acesso"
                              disabled={busy}
                              onClick={() => askApprove(u)}
                              className="text-brand-ok hover:opacity-70 disabled:opacity-40"
                            >
                              <UserCheck size={16} />
                            </button>
                          )}
                          {u.status !== "DEACTIVATED" ? (
                            <button
                              type="button"
                              title="Desativar acesso"
                              disabled={busy}
                              onClick={() => askDeactivate(u)}
                              className="text-brand-crit hover:opacity-70 disabled:opacity-40"
                            >
                              <UserX size={16} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              title="Reativar acesso"
                              disabled={busy}
                              onClick={() => askReactivate(u)}
                              className="text-brand-ok hover:opacity-70 disabled:opacity-40"
                            >
                              <UserCheck size={16} />
                            </button>
                          )}
                          <button
                            type="button"
                            title="Excluir usuário"
                            disabled={busy}
                            onClick={() => askDelete(u)}
                            className="text-brand-crit hover:opacity-70 disabled:opacity-40"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {pendingAction && (
        <ConfirmDialog
          title={pendingAction.title}
          message={pendingAction.message}
          confirmLabel={pendingAction.confirmLabel}
          loading={busyId === pendingAction.user.id}
          onConfirm={confirmPendingAction}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}
