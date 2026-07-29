"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { KitModal } from "@/components/kits/kit-modal";
import { KitOutputModal } from "@/components/kits/kit-output-modal";
import type { KitDTO } from "@/types/kit";
import type { StockOptionDTO } from "@/types/movement";

export function KitGrid({ initialKits, stock }: { initialKits: KitDTO[]; stock: StockOptionDTO[] }) {
  const [kits, setKits] = useState(initialKits);
  const [showModal, setShowModal] = useState(false);
  const [outputKit, setOutputKit] = useState<KitDTO | undefined>(undefined);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<KitDTO | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          <Button onClick={() => setShowModal(true)}>
            <Plus size={16} /> Novo kit
          </Button>
        }
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kits.map((k) => (
          <Card key={k.id} className="flex flex-col transition-shadow hover:shadow-md">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="font-medium text-zinc-900 dark:text-zinc-50">{k.name}</div>
              <button
                type="button"
                onClick={() => setConfirmDeleteTarget(k)}
                disabled={deletingId === k.id}
                className="shrink-0 text-brand-crit hover:opacity-70 disabled:opacity-40"
                aria-label="Excluir kit"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <ul className="mb-4 flex-1 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              {k.items.map((ci) => (
                <li key={ci.id}>
                  {ci.quantity}x {ci.stockItem.name}
                </li>
              ))}
            </ul>
            <Button variant="secondary" className="w-full justify-center" onClick={() => setOutputKit(k)}>
              Registrar saída de kit
            </Button>
          </Card>
        ))}
        {kits.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-3">
            <EmptyState message="Nenhum kit cadastrado." />
          </div>
        )}
      </div>

      {showModal && <KitModal stock={stock} onClose={() => setShowModal(false)} onSaved={refresh} />}
      {outputKit && <KitOutputModal kit={outputKit} onClose={() => setOutputKit(undefined)} onSaved={refresh} />}

      {confirmDeleteTarget && (
        <ConfirmDialog
          title="Excluir kit"
          message={`Excluir o kit "${confirmDeleteTarget.name}"? Essa ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          cancelLabel="Cancelar"
          danger
          loading={deletingId === confirmDeleteTarget.id}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmDeleteTarget(null)}
        />
      )}
    </div>
  );
}
