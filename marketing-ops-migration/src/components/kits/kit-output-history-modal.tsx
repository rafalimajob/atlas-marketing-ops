"use client";

import { useEffect, useState } from "react";
import { Undo2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { DateRangeFilter, ALL_TIME_RANGE, type DateRange } from "@/components/ui/date-range-filter";
import type { KitOutputDTO } from "@/types/kit";

const PAGE_SIZE = 20;

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

async function fetchPage(kitId: string, range: DateRange, skip: number) {
  const params = new URLSearchParams();
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  params.set("skip", String(skip));
  params.set("take", String(PAGE_SIZE));
  const res = await fetch(`/api/kits/${kitId}/outputs?${params.toString()}`);
  if (!res.ok) throw new Error("Não foi possível carregar o histórico de saídas.");
  return (await res.json()) as { items: KitOutputDTO[]; total: number };
}

export function KitOutputHistoryModal({
  kit,
  onClose,
  onChanged,
}: {
  kit: { id: string; name: string };
  onClose: () => void;
  onChanged: () => void;
}) {
  const [range, setRange] = useState<DateRange>(ALL_TIME_RANGE);
  const [items, setItems] = useState<KitOutputDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<KitOutputDTO | null>(null);
  const [returnQuantity, setReturnQuantity] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Deferido a um microtask para não disparar setState de forma síncrona
    // no corpo do efeito (ver react-hooks/set-state-in-effect).
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      fetchPage(kit.id, range, 0)
        .then((page) => {
          if (cancelled) return;
          setItems(page.items);
          setTotal(page.total);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : "Erro inesperado.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [kit.id, range]);

  async function loadMore() {
    setLoadingMore(true);
    setError(null);
    try {
      const page = await fetchPage(kit.id, range, items.length);
      setItems((prev) => [...prev, ...page.items]);
      setTotal(page.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function confirmDelete() {
    const output = confirmDeleteTarget;
    if (!output) return;
    setError(null);
    setDeletingId(output.id);
    try {
      const res = await fetch(`/api/kit-outputs/${output.id}?quantity=${returnQuantity}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível devolver esta saída ao estoque.");
      if (returnQuantity >= output.quantity) {
        setItems((prev) => prev.filter((o) => o.id !== output.id));
        setTotal((prev) => prev - 1);
      } else {
        setItems((prev) => prev.map((o) => (o.id === output.id ? { ...o, quantity: data.remainingQuantity } : o)));
      }
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
          Devolver uma saída repõe o estoque proporcional de cada item componente. Devolver a
          quantidade inteira remove o registro de Movimentações e Consumo por área; devolver menos
          (ex.: retiraram 30, sobraram 10 sem uso) mantém o registro com a quantidade restante.
        </p>

        <DateRangeFilter value={range} onChange={setRange} />

        {loading ? (
          <p className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">Carregando...</p>
        ) : items.length === 0 ? (
          <EmptyState
            message={
              total === 0 && !range.from && !range.to
                ? "Nenhuma saída registrada para este kit."
                : "Nenhuma saída encontrada no período selecionado."
            }
          />
        ) : (
          <>
            <ul className="space-y-2">
              {items.map((o) => (
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
                      setReturnQuantity(o.quantity);
                    }}
                    disabled={deletingId === o.id}
                    className="flex shrink-0 items-center gap-1 text-brand-crit hover:opacity-70 disabled:opacity-40"
                    aria-label="Devolver ao estoque"
                    title="Devolver ao estoque"
                  >
                    <Undo2 size={15} />
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>
                Mostrando {items.length} de {total}
              </span>
              {items.length < total && (
                <Button type="button" variant="secondary" size="sm" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? "Carregando..." : "Carregar mais"}
                </Button>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>

      {confirmDeleteTarget && (
        <ConfirmDialog
          title="Devolver saída ao estoque"
          message={
            returnQuantity >= confirmDeleteTarget.quantity
              ? `Devolver os ${confirmDeleteTarget.quantity}x "${kit.name}" inteiros? O estoque de todos os itens componentes será restaurado e o registro será removido de Movimentações e Consumo por área. Essa ação não pode ser desfeita.`
              : `Devolver ${returnQuantity}x de ${confirmDeleteTarget.quantity}x "${kit.name}" retirados? O estoque proporcional de cada item componente será restaurado; o registro continua, com ${confirmDeleteTarget.quantity - returnQuantity}x restantes. Essa ação não pode ser desfeita.`
          }
          confirmLabel="Devolver ao estoque"
          cancelLabel="Cancelar"
          danger
          loading={deletingId === confirmDeleteTarget.id}
          error={error}
          confirmDisabled={!Number.isInteger(returnQuantity) || returnQuantity < 1 || returnQuantity > confirmDeleteTarget.quantity}
          onConfirm={confirmDelete}
          onCancel={() => {
            setConfirmDeleteTarget(null);
            setError(null);
          }}
        >
          <Input
            label={`Quantidade a devolver (máx. ${confirmDeleteTarget.quantity})`}
            type="number"
            min={1}
            max={confirmDeleteTarget.quantity}
            value={returnQuantity}
            onChange={(e) => setReturnQuantity(Number(e.target.value))}
          />
        </ConfirmDialog>
      )}
    </Modal>
  );
}
