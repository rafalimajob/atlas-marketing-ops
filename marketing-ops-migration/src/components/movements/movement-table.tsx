"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Edit2, Trash2, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateRangeFilter, ALL_TIME_RANGE, isInRange } from "@/components/ui/date-range-filter";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { MovementModal } from "@/components/movements/movement-modal";
import { MOVEMENT_TYPE_LABEL } from "@/lib/movement-types";
import { matchesSearch } from "@/lib/search";
import type { MovementDTO, StockOptionDTO } from "@/types/movement";

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

function isLocked(m: MovementDTO) {
  return Boolean(m.orderId || m.kitOutputId || m.areaId);
}

export function MovementTable({
  initialMovements,
  stock,
}: {
  initialMovements: MovementDTO[];
  stock: StockOptionDTO[];
}) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [movements, setMovements] = useState(initialMovements);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState(ALL_TIME_RANGE);
  const [editing, setEditing] = useState<MovementDTO | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      movements.filter(
        (m) =>
          isInRange(m.date, range) &&
          matchesSearch(
            [m.stockItem.name, m.stockItem.code, MOVEMENT_TYPE_LABEL[m.type], m.project, m.performedBy.name, m.notes],
            search
          )
      ),
    [movements, search, range]
  );

  async function refresh() {
    const res = await fetch("/api/movements");
    if (res.ok) setMovements(await res.json());
  }

  function closeModal() {
    setShowModal(false);
    setEditing(undefined);
  }

  async function handleDelete(m: MovementDTO) {
    if (
      !confirm(
        `Excluir esta movimentação de ${m.direction === "ENTRADA" ? "entrada" : "saída"} de ${m.quantity}x "${m.stockItem.name}"? O saldo do item será ajustado de volta. Essa ação não pode ser desfeita.`
      )
    )
      return;
    setError(null);
    setDeletingId(m.id);
    try {
      const res = await fetch(`/api/movements/${m.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível excluir a movimentação.");
      setMovements((prev) => prev.filter((x) => x.id !== m.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Movimentações"
        description="Histórico de entradas e saídas de estoque"
        actions={
          <Button
            onClick={() => {
              setEditing(undefined);
              setShowModal(true);
            }}
          >
            <Plus size={16} /> Nova movimentação
          </Button>
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <Input
          placeholder="Buscar por item, tipo, projeto, responsável ou observação..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900/60">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Data</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Tipo</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Item</th>
              <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Quantidade</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Projeto/Campanha</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Responsável</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Observação</th>
              {isAdmin && <th className="px-3 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => {
              const signed = m.direction === "ENTRADA" ? m.quantity : -m.quantity;
              const locked = isLocked(m);
              return (
                <tr
                  key={m.id}
                  className="border-t border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40"
                >
                  <td className="px-3 py-2.5 text-zinc-500 dark:text-zinc-400">{fmtDateTime(m.date)}</td>
                  <td className="px-3 py-2.5 text-zinc-900 dark:text-zinc-50">{MOVEMENT_TYPE_LABEL[m.type]}</td>
                  <td className="px-3 py-2.5 font-medium text-zinc-900 dark:text-zinc-50">{m.stockItem.name}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums font-medium ${signed > 0 ? "text-brand-ok" : "text-brand-crit"}`}>
                    {signed > 0 ? "+" : ""}
                    {signed}
                  </td>
                  <td className="px-3 py-2.5 text-zinc-500 dark:text-zinc-400">{m.project ?? "—"}</td>
                  <td className="px-3 py-2.5 text-zinc-500 dark:text-zinc-400">{m.performedBy.name}</td>
                  <td className="px-3 py-2.5 text-zinc-500 dark:text-zinc-400">{m.notes ?? "—"}</td>
                  {isAdmin && (
                    <td className="px-3 py-2.5">
                      {locked ? (
                        <div
                          className="flex items-center justify-end text-zinc-300 dark:text-zinc-700"
                          title="Gerada automaticamente (pedido, kit ou consumo por área) — não pode ser editada ou excluída aqui."
                        >
                          <Lock size={14} />
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(m);
                              setShowModal(true);
                            }}
                            className="text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
                            aria-label="Editar"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(m)}
                            disabled={deletingId === m.id}
                            className="text-brand-crit hover:opacity-70 disabled:opacity-40"
                            aria-label="Excluir"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 8 : 7} className="py-2">
                  <EmptyState
                    message={
                      movements.length === 0
                        ? "Nenhuma movimentação registrada."
                        : "Nenhuma movimentação encontrada para os filtros selecionados."
                    }
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {showModal && <MovementModal movement={editing} stock={stock} onClose={closeModal} onSaved={refresh} />}
    </div>
  );
}
