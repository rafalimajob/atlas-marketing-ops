"use client";

import { useMemo, useState } from "react";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { OrderModal } from "@/components/orders/order-modal";
import { ORDER_STATUS_VALUES, ORDER_STATUS_LABEL, ORDER_STATUS_COLOR } from "@/lib/order-status";
import { matchesSearch } from "@/lib/search";
import type { OrderDTO } from "@/types/order";
import type { OrderStatusValue } from "@/lib/order-status";
import type { StockOptionDTO } from "@/types/movement";

type SortKey = "item" | "quantity" | "ocNumber" | "project" | "status" | "requestDate" | "expectedDate" | "deliveredDate";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "item", label: "Item" },
  { key: "quantity", label: "Quantidade" },
  { key: "ocNumber", label: "OC" },
  { key: "project", label: "Projeto/Campanha" },
  { key: "status", label: "Status" },
  { key: "requestDate", label: "Solicitação" },
  { key: "expectedDate", label: "Previsão" },
  { key: "deliveredDate", label: "Entrega" },
];

const SORT_GETTERS: Record<SortKey, (o: OrderDTO) => string | number> = {
  item: (o) => o.stockItem.name,
  quantity: (o) => o.quantity,
  ocNumber: (o) => o.ocNumber,
  project: (o) => o.project,
  status: (o) => o.status,
  requestDate: (o) => o.requestDate,
  expectedDate: (o) => o.expectedDate ?? "",
  deliveredDate: (o) => o.deliveredDate ?? "",
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");

export function OrderTable({ initialOrders, stock }: { initialOrders: OrderDTO[]; stock: StockOptionDTO[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatusValue | "TODOS">("TODOS");
  const [sortKey, setSortKey] = useState<SortKey>("requestDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [editing, setEditing] = useState<OrderDTO | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<OrderDTO | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = orders.filter(
      (o) =>
        (statusFilter === "TODOS" || o.status === statusFilter) &&
        matchesSearch([o.stockItem.name, o.ocNumber, o.project], search)
    );
    const dir = sortDir === "asc" ? 1 : -1;
    const getter = SORT_GETTERS[sortKey];
    return [...list].sort((a, b) => (getter(a) > getter(b) ? dir : -dir));
  }, [orders, search, statusFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  async function refresh() {
    const res = await fetch("/api/orders");
    if (res.ok) setOrders(await res.json());
  }

  function closeModal() {
    setShowModal(false);
    setEditing(undefined);
  }

  async function confirmDelete() {
    const order = confirmDeleteTarget;
    if (!order) return;
    setError(null);
    setDeletingId(order.id);
    try {
      const res = await fetch(`/api/orders/${order.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível excluir o pedido.");
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
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
        title="Pedidos de Compra"
        description="Ordens de compra vinculadas ao estoque"
        actions={
          <Button
            onClick={() => {
              setEditing(undefined);
              setShowModal(true);
            }}
          >
            <Plus size={16} /> Novo pedido
          </Button>
        }
      />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar por item, OC ou projeto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72"
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as OrderStatusValue | "TODOS")}
          className="w-56"
        >
          <option value="TODOS">Todos</option>
          {ORDER_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900/60">
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className={`cursor-pointer select-none whitespace-nowrap px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400 ${
                    col.key === "quantity" ? "text-right" : "text-left"
                  }`}
                >
                  {col.label} {sortKey === col.key ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </th>
              ))}
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => {
              const atrasado =
                o.status !== "ENTREGUE" && o.status !== "CANCELADO" && o.expectedDate && o.expectedDate.slice(0, 10) < todayISO();
              return (
                <tr
                  key={o.id}
                  className={`border-t border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40 ${atrasado ? "bg-red-500/5" : ""}`}
                >
                  <td className="px-3 py-2.5 font-medium text-zinc-900 dark:text-zinc-50">{o.stockItem.name}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">{o.quantity}</td>
                  <td className="px-3 py-2.5 text-zinc-500 dark:text-zinc-400">{o.ocNumber}</td>
                  <td className="px-3 py-2.5 text-zinc-500 dark:text-zinc-400">{o.project}</td>
                  <td className="px-3 py-2.5">
                    <Badge color={ORDER_STATUS_COLOR[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-zinc-500 dark:text-zinc-400">{fmtDate(o.requestDate)}</td>
                  <td
                    className={`px-3 py-2.5 ${atrasado ? "font-medium text-brand-crit" : "text-zinc-500 dark:text-zinc-400"}`}
                  >
                    {fmtDate(o.expectedDate)}
                  </td>
                  <td className="px-3 py-2.5 text-zinc-500 dark:text-zinc-400">{fmtDate(o.deliveredDate)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(o);
                          setShowModal(true);
                        }}
                        className="text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
                        aria-label="Editar"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteTarget(o)}
                        disabled={deletingId === o.id}
                        className="text-brand-crit hover:opacity-70 disabled:opacity-40"
                        aria-label="Excluir"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="py-2">
                  <EmptyState message="Nenhum pedido encontrado." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {showModal && <OrderModal order={editing} stock={stock} onClose={closeModal} onSaved={refresh} />}

      {confirmDeleteTarget && (
        <ConfirmDialog
          title="Excluir pedido"
          message={`Excluir o pedido de "${confirmDeleteTarget.stockItem.name}" (OC ${confirmDeleteTarget.ocNumber})? Essa ação não pode ser desfeita.`}
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
