"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Settings2, Boxes, Wallet, ArrowDownRight, Edit2, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateRangeFilter, ALL_TIME_RANGE, isInRange } from "@/components/ui/date-range-filter";
import { StatCard } from "@/components/dashboard/stat-card";
import { ProjectConsumptionChart } from "@/components/dashboard/dashboard-charts";
import { AreaWithdrawalModal } from "@/components/area-consumption/area-withdrawal-modal";
import { AreaManagerModal } from "@/components/area-consumption/area-manager-modal";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { matchesSearch } from "@/lib/search";
import { CHART_COLORS } from "@/lib/theme-colors";
import type { AreaDTO } from "@/types/area";
import type { MovementDTO, StockOptionDTO } from "@/types/movement";

const { purple: PURPLE, primary: PRIMARY, crit: CRIT } = CHART_COLORS;

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function AreaConsumptionView({
  initialWithdrawals,
  areas,
  stock,
}: {
  initialWithdrawals: MovementDTO[];
  areas: AreaDTO[];
  stock: StockOptionDTO[];
}) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [withdrawals, setWithdrawals] = useState(initialWithdrawals);
  const [areaList, setAreaList] = useState(areas);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState(ALL_TIME_RANGE);
  const [editing, setEditing] = useState<MovementDTO | undefined>(undefined);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<MovementDTO | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshWithdrawals() {
    const res = await fetch("/api/area-withdrawals");
    if (res.ok) setWithdrawals(await res.json());
  }

  async function refreshAreas() {
    const res = await fetch("/api/areas");
    if (res.ok) setAreaList(await res.json());
  }

  function closeWithdrawalModal() {
    setShowWithdrawalModal(false);
    setEditing(undefined);
  }

  async function confirmDelete() {
    const m = confirmDeleteTarget;
    if (!m) return;
    setError(null);
    setDeletingId(m.id);
    try {
      const res = await fetch(`/api/area-withdrawals/${m.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível excluir a retirada.");
      setWithdrawals((prev) => prev.filter((x) => x.id !== m.id));
      setConfirmDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = useMemo(
    () =>
      withdrawals.filter(
        (m) =>
          isInRange(m.date, range) &&
          matchesSearch([m.area?.name, m.stockItem.name, m.stockItem.code, m.project, m.performedBy.name, m.notes], search)
      ),
    [withdrawals, search, range]
  );

  const totalQty = filtered.reduce((a, m) => a + m.quantity, 0);
  const totalValue = filtered.reduce((a, m) => a + (m.totalCost ? Number(m.totalCost) : 0), 0);

  const byAreaValue = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of filtered) {
      const name = m.area?.name ?? "Sem área";
      map.set(name, (map.get(name) ?? 0) + (m.totalCost ? Number(m.totalCost) : 0));
    }
    return [...map.entries()].map(([project, qty]) => ({ project, qty }));
  }, [filtered]);

  const byAreaQty = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of filtered) {
      const name = m.area?.name ?? "Sem área";
      map.set(name, (map.get(name) ?? 0) + m.quantity);
    }
    return [...map.entries()].map(([project, qty]) => ({ project, qty }));
  }, [filtered]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consumo por área"
        description="Retiradas de materiais realizadas pelas áreas da instituição"
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowManagerModal(true)}>
              <Settings2 size={16} /> Gerenciar áreas
            </Button>
            <Button
              onClick={() => {
                setEditing(undefined);
                setShowWithdrawalModal(true);
              }}
            >
              <Plus size={16} /> Nova retirada
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Retiradas no período" value={filtered.length} color={PRIMARY} icon={ArrowDownRight} />
        <StatCard label="Itens retirados (qtd.)" value={totalQty} color={PURPLE} icon={Boxes} />
        <Card className="flex items-center justify-between">
          <div>
            <div className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">Valor consumido no período</div>
            <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{fmtBRL(totalValue)}</div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${CRIT}1A` }}>
            <Wallet size={18} style={{ color: CRIT }} />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ProjectConsumptionChart data={byAreaQty} title="Quantidade de itens consumida por área" />
        <ProjectConsumptionChart data={byAreaValue} title="Valor consumido por área" valueFormatter={fmtBRL} />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <Input
          placeholder="Buscar por área, item, projeto, responsável ou observação..."
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
              <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Área</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Item</th>
              <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Quantidade</th>
              <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Custo unit.</th>
              <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Valor total</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Responsável</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Observação</th>
              {isAdmin && <th className="px-3 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr
                key={m.id}
                className="border-t border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40"
              >
                <td className="px-3 py-2.5 text-zinc-500 dark:text-zinc-400">{fmtDate(m.date)}</td>
                <td className="px-3 py-2.5 text-zinc-900 dark:text-zinc-50">{m.area?.name ?? "—"}</td>
                <td className="px-3 py-2.5 font-medium text-zinc-900 dark:text-zinc-50">{m.stockItem.name}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-medium text-brand-crit">-{m.quantity}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                  {m.unitCost ? fmtBRL(Number(m.unitCost)) : "—"}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                  {m.totalCost ? fmtBRL(Number(m.totalCost)) : "—"}
                </td>
                <td className="px-3 py-2.5 text-zinc-500 dark:text-zinc-400">{m.performedBy.name}</td>
                <td className="px-3 py-2.5 text-zinc-500 dark:text-zinc-400">{m.notes ?? "—"}</td>
                {isAdmin && (
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(m);
                          setShowWithdrawalModal(true);
                        }}
                        className="text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
                        aria-label="Editar"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteTarget(m)}
                        disabled={deletingId === m.id}
                        className="text-brand-crit hover:opacity-70 disabled:opacity-40"
                        aria-label="Excluir"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 9 : 8} className="py-2">
                  <EmptyState
                    message={
                      withdrawals.length === 0
                        ? "Nenhuma retirada registrada."
                        : "Nenhuma retirada encontrada para os filtros selecionados."
                    }
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {showWithdrawalModal && (
        <AreaWithdrawalModal
          withdrawal={editing}
          areas={areaList}
          stock={stock}
          onClose={closeWithdrawalModal}
          onSaved={refreshWithdrawals}
        />
      )}
      {showManagerModal && (
        <AreaManagerModal
          areas={areaList}
          onClose={() => setShowManagerModal(false)}
          onChanged={refreshAreas}
        />
      )}

      {confirmDeleteTarget && (
        <ConfirmDialog
          title="Excluir retirada"
          message={`Excluir esta retirada de ${confirmDeleteTarget.quantity}x "${confirmDeleteTarget.stockItem.name}" pela área "${confirmDeleteTarget.area?.name}"? O saldo do item será ajustado de volta. Essa ação não pode ser desfeita.`}
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
