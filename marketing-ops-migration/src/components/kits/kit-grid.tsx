"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Pencil, Trash2, History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { KitModal } from "@/components/kits/kit-modal";
import { KitOutputModal } from "@/components/kits/kit-output-modal";
import { KitOutputHistoryModal } from "@/components/kits/kit-output-history-modal";
import { isAdminRole, canWrite } from "@/lib/permissions";
import type { KitDTO } from "@/types/kit";
import type { StockOptionDTO } from "@/types/movement";
import type { AreaDTO } from "@/types/area";

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function kitValue(k: KitDTO) {
  let total = 0;
  let hasMissingCost = false;
  for (const ci of k.items) {
    if (ci.stockItem.lastCost) {
      total += Number(ci.stockItem.lastCost) * ci.quantity;
    } else {
      hasMissingCost = true;
    }
  }
  return { total, hasMissingCost };
}

export function KitGrid({
  initialKits,
  stock,
  areas,
}: {
  initialKits: KitDTO[];
  stock: StockOptionDTO[];
  areas: AreaDTO[];
}) {
  const { data: session } = useSession();
  const isAdmin = Boolean(session?.user?.role && isAdminRole(session.user.role));
  const canCreate = Boolean(session?.user?.role && canWrite(session.user.role));
  const [kits, setKits] = useState(initialKits);
  const [editing, setEditing] = useState<KitDTO | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);
  const [outputKit, setOutputKit] = useState<KitDTO | undefined>(undefined);
  const [historyKitId, setHistoryKitId] = useState<string | undefined>(undefined);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<KitDTO | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const historyKit = kits.find((k) => k.id === historyKitId);

  async function refresh() {
    const res = await fetch("/api/kits");
    if (res.ok) setKits(await res.json());
  }

  async function confirmDelete() {
    const kit = confirmDeleteTarget;
    if (!kit) return;
    setError(null);
    setDeletingId(kit.id);
    try {
      const res = await fetch(`/api/kits/${kit.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível excluir o kit.");
      setKits((prev) => prev.filter((k) => k.id !== kit.id));
      setConfirmDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Kits"
        description="Conjuntos de itens para saída rápida em eventos e campanhas"
        actions={
          canCreate && (
            <Button
              onClick={() => {
                setEditing(undefined);
                setShowModal(true);
              }}
            >
              <Plus size={16} /> Novo kit
            </Button>
          )
        }
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kits.map((k) => {
          const { total, hasMissingCost } = kitValue(k);
          return (
          <Card key={k.id} className="flex flex-col transition-shadow hover:shadow-md">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="font-medium text-zinc-900 dark:text-zinc-50">{k.name}</div>
              {isAdmin && (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(k);
                      setShowModal(true);
                    }}
                    className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                    aria-label="Editar kit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setConfirmDeleteTarget(k);
                    }}
                    disabled={deletingId === k.id}
                    className="text-brand-crit hover:opacity-70 disabled:opacity-40"
                    aria-label="Excluir kit"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
            <ul className="mb-3 flex-1 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              {k.items.map((ci) => (
                <li key={ci.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {ci.quantity}x {ci.stockItem.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">
                    {ci.stockItem.lastCost ? fmtBRL(Number(ci.stockItem.lastCost) * ci.quantity) : "—"}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mb-4 flex items-center justify-between border-t border-zinc-100 pt-2 text-sm dark:border-zinc-800">
              <span className="font-medium text-zinc-900 dark:text-zinc-50">
                Valor total {hasMissingCost && <span className="font-normal text-zinc-400">(parcial)</span>}
              </span>
              <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{fmtBRL(total)}</span>
            </div>
            {isAdmin && k.outputsCount > 0 && (
              <button
                type="button"
                onClick={() => setHistoryKitId(k.id)}
                className="mb-3 flex items-center gap-1 self-start text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                <History size={12} /> {k.outputsCount} saída(s) registrada(s) — ver/desfazer
              </button>
            )}
            {canCreate && (
              <Button variant="secondary" className="w-full justify-center" onClick={() => setOutputKit(k)}>
                Registrar saída de kit
              </Button>
            )}
          </Card>
          );
        })}
        {kits.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-3">
            <EmptyState message="Nenhum kit cadastrado." />
          </div>
        )}
      </div>

      {showModal && (
        <KitModal
          kit={editing}
          stock={stock}
          onClose={() => {
            setShowModal(false);
            setEditing(undefined);
          }}
          onSaved={refresh}
        />
      )}
      {outputKit && (
        <KitOutputModal kit={outputKit} areas={areas} onClose={() => setOutputKit(undefined)} onSaved={refresh} />
      )}
      {historyKit && (
        <KitOutputHistoryModal kit={historyKit} onClose={() => setHistoryKitId(undefined)} onChanged={refresh} />
      )}

      {confirmDeleteTarget && (
        <ConfirmDialog
          title="Excluir kit"
          message={`Excluir o kit "${confirmDeleteTarget.name}"? Essa ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          cancelLabel="Cancelar"
          danger
          loading={deletingId === confirmDeleteTarget.id}
          error={error}
          onConfirm={confirmDelete}
          onCancel={() => {
            setConfirmDeleteTarget(null);
            setError(null);
          }}
        />
      )}
    </div>
  );
}
