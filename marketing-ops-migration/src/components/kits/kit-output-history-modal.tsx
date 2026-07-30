"use client";

import { useState } from "react";
import { Undo2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import type { KitDTO, KitOutputDTO } from "@/types/kit";

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function KitOutputHistoryModal({
  kit,
  onClose,
  onChanged,
}: {
  kit: KitDTO;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<KitOutputDTO | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    const output = confirmDeleteTarget;
    if (!output) return;
    setError(null);
    setDeletingId(output.id);
    try {
      const res = await fetch(`/api/kit-outputs/${output.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível desfazer esta saída.");
      setConfirmDeleteTarget(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Modal title={`Saídas registradas: ${kit.name}`} onClose={onClose} wide>
      <div className="space-y-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Desfazer uma saída devolve ao estoque a quantidade de cada item retirado e remove esse
          registro de Movimentações e Consumo por área. Use quando a retirada foi um engano.
        </p>

        {kit.outputs.length === 0 ? (
          <EmptyState message="Nenhuma saída registrada para este kit." />
        ) : (
          <ul className="space-y-2">
            {kit.outputs.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
              >
                <div className="text-sm">
                  <div className="font-medium text-zinc-900 dark:text-zinc-50">
                    {o.quantity}x — {fmtDateTime(o.date)}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {o.area?.name ?? "Sem área"} · {o.performedBy.name}
                    {o.project ? ` · ${o.project}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setConfirmDeleteTarget(o);
                  }}
                  disabled={deletingId === o.id}
                  className="flex shrink-0 items-center gap-1 text-brand-crit hover:opacity-70 disabled:opacity-40"
                  aria-label="Desfazer saída"
                  title="Desfazer saída"
                >
                  <Undo2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>

      {confirmDeleteTarget && (
        <ConfirmDialog
          title="Desfazer saída de kit"
          message={`Desfazer a saída de ${confirmDeleteTarget.quantity}x "${kit.name}"? O estoque de todos os itens componentes será devolvido e o registro será removido de Movimentações e Consumo por área. Essa ação não pode ser desfeita.`}
          confirmLabel="Desfazer saída"
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
    </Modal>
  );
}
