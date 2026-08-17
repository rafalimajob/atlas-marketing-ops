"use client";

import { useEffect, useState } from "react";
import { History as HistoryIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ErrorBanner } from "@/components/ui/error-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { DateRangeFilter, ALL_TIME_RANGE, type DateRange } from "@/components/ui/date-range-filter";
import { HISTORY_ACTION_COLOR, HISTORY_ACTION_LABEL, HISTORY_ENTITY_LABEL } from "@/lib/history-labels";
import type { HistoryLogDTO } from "@/types/history";
import type { HistoryAction, HistoryEntity } from "@/generated/prisma/client";

const PAGE_SIZE = 20;

const HISTORY_ENTITY_VALUES = Object.keys(HISTORY_ENTITY_LABEL) as HistoryEntity[];
const HISTORY_ACTION_VALUES = Object.keys(HISTORY_ACTION_LABEL) as HistoryAction[];

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

interface Filters {
  entity: HistoryEntity | "";
  action: HistoryAction | "";
  userId: string;
  range: DateRange;
}

const INITIAL_FILTERS: Filters = { entity: "", action: "", userId: "", range: ALL_TIME_RANGE };

async function fetchPage(filters: Filters, skip: number) {
  const params = new URLSearchParams();
  if (filters.entity) params.set("entity", filters.entity);
  if (filters.action) params.set("action", filters.action);
  if (filters.userId) params.set("userId", filters.userId);
  if (filters.range.from) params.set("from", filters.range.from);
  if (filters.range.to) params.set("to", filters.range.to);
  params.set("skip", String(skip));
  params.set("take", String(PAGE_SIZE));
  const res = await fetch(`/api/history-logs?${params.toString()}`);
  if (!res.ok) throw new Error("Não foi possível carregar o histórico de auditoria.");
  return (await res.json()) as { items: HistoryLogDTO[]; total: number };
}

function DiffTable({ diff }: { diff: NonNullable<HistoryLogDTO["diff"]> }) {
  const fields = Object.keys(diff);
  if (fields.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Sem detalhes de campo registrados.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
            <th className="py-1.5 pr-3 font-medium">Campo</th>
            <th className="py-1.5 pr-3 font-medium">Antes</th>
            <th className="py-1.5 font-medium">Depois</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field} className="border-b border-zinc-50 align-top dark:border-zinc-800/60">
              <td className="py-1.5 pr-3 font-medium text-zinc-700 dark:text-zinc-300">{field}</td>
              <td className="py-1.5 pr-3 text-zinc-500 dark:text-zinc-400">{String(diff[field].before ?? "—")}</td>
              <td className="py-1.5 text-zinc-900 dark:text-zinc-50">{String(diff[field].after ?? "—")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HistoryLogView({ users }: { users: { id: string; name: string }[] }) {
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [items, setItems] = useState<HistoryLogDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<HistoryLogDTO | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Deferido a um microtask para não disparar setState de forma síncrona
    // no corpo do efeito (ver react-hooks/set-state-in-effect).
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      fetchPage(filters, 0)
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
  }, [filters]);

  async function loadMore() {
    setLoadingMore(true);
    setError(null);
    try {
      const page = await fetchPage(filters, items.length);
      setItems((prev) => [...prev, ...page.items]);
      setTotal(page.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoadingMore(false);
    }
  }

  const hasActiveFilter =
    filters.entity !== "" || filters.action !== "" || filters.userId !== "" || filters.range.from !== "" || filters.range.to !== "";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Auditoria"
        description="Todo registro criado, alterado ou excluído no sistema, com quem fez e quando."
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <Card className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label="Tipo de registro"
            value={filters.entity}
            onChange={(e) => setFilters((f) => ({ ...f, entity: e.target.value as HistoryEntity | "" }))}
            className="w-auto min-w-[10rem]"
          >
            <option value="">Todos</option>
            {HISTORY_ENTITY_VALUES.map((entity) => (
              <option key={entity} value={entity}>
                {HISTORY_ENTITY_LABEL[entity]}
              </option>
            ))}
          </Select>

          <Select
            label="Ação"
            value={filters.action}
            onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value as HistoryAction | "" }))}
            className="w-auto min-w-[9rem]"
          >
            <option value="">Todas</option>
            {HISTORY_ACTION_VALUES.map((action) => (
              <option key={action} value={action}>
                {HISTORY_ACTION_LABEL[action]}
              </option>
            ))}
          </Select>

          <Select
            label="Usuário"
            value={filters.userId}
            onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value }))}
            className="w-auto min-w-[10rem]"
          >
            <option value="">Todos</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </div>

        <DateRangeFilter value={filters.range} onChange={(range) => setFilters((f) => ({ ...f, range }))} />

        {loading ? (
          <p className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">Carregando...</p>
        ) : items.length === 0 ? (
          <EmptyState
            icon={HistoryIcon}
            message={hasActiveFilter ? "Nenhum registro encontrado com esses filtros." : "Nenhum registro de auditoria ainda."}
          />
        ) : (
          <>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {items.map((log) => (
                <li key={log.id} className="py-2.5">
                  <button
                    type="button"
                    onClick={() => setDetail(log)}
                    className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Badge color={HISTORY_ACTION_COLOR[log.action]}>{HISTORY_ACTION_LABEL[log.action]}</Badge>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{log.summary}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {HISTORY_ENTITY_LABEL[log.entity]} · {log.user?.name ?? "Sistema"}
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">{fmtDateTime(log.timestamp)}</span>
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
      </Card>

      {detail && (
        <Modal title={HISTORY_ENTITY_LABEL[detail.entity]} onClose={() => setDetail(null)} wide>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge color={HISTORY_ACTION_COLOR[detail.action]}>{HISTORY_ACTION_LABEL[detail.action]}</Badge>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">{fmtDateTime(detail.timestamp)}</span>
            </div>
            <p className="text-sm text-zinc-900 dark:text-zinc-50">{detail.summary}</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              <dt>Usuário</dt>
              <dd className="text-right">{detail.user?.name ?? "Sistema"}</dd>
              <dt>ID do registro</dt>
              <dd className="truncate text-right" title={detail.entityId}>
                {detail.entityId}
              </dd>
            </dl>
            {detail.diff && Object.keys(detail.diff).length > 0 && (
              <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <DiffTable diff={detail.diff} />
              </div>
            )}
            <div className="flex justify-end pt-1">
              <Button type="button" variant="ghost" onClick={() => setDetail(null)}>
                Fechar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
