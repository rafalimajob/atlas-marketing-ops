"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Settings2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ViewToggle, type ViewMode } from "@/components/ui/view-toggle";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StockCardGrid } from "@/components/stock/stock-card-grid";
import { StockListView } from "@/components/stock/stock-list-view";
import { StockModal } from "@/components/stock/stock-modal";
import { CategoryManagerModal } from "@/components/stock/category-manager-modal";
import { StockLevelFilter } from "@/components/stock/stock-level-filter";
import { matchesSearch } from "@/lib/search";
import { getStockLevel, type StockLevel } from "@/lib/stock-level";
import type { StockItemDTO } from "@/types/stock";
import type { CategoryDTO } from "@/types/category";

const VIEW_STORAGE_KEY = "estoque-view";

export function StockGrid({
  initialItems,
  initialCategories,
}: {
  initialItems: StockItemDTO[];
  initialCategories: CategoryDTO[];
}) {
  const [items, setItems] = useState(initialItems);
  const [categories, setCategories] = useState(initialCategories);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<StockLevel | "TODOS">("TODOS");
  const [view, setView] = useState<ViewMode>("grid");
  const [editing, setEditing] = useState<StockItemDTO | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<StockItemDTO | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Deferido a um microtask para não disparar setState de forma síncrona
    // no corpo do efeito (ver react-hooks/set-state-in-effect).
    Promise.resolve().then(() => {
      const stored = localStorage.getItem(VIEW_STORAGE_KEY);
      if (stored === "list" || stored === "grid") setView(stored);
    });
  }, []);

  function changeView(next: ViewMode) {
    setView(next);
    localStorage.setItem(VIEW_STORAGE_KEY, next);
  }

  const searchFiltered = useMemo(
    () => items.filter((s) => matchesSearch([s.name, s.category, s.code], search)),
    [items, search]
  );

  const levelCounts = useMemo(() => {
    const counts: Record<StockLevel, number> = { crit: 0, warn: 0, ok: 0 };
    for (const s of searchFiltered) counts[getStockLevel(s.quantity, s.minStock)]++;
    return counts;
  }, [searchFiltered]);

  const filtered = useMemo(
    () =>
      searchFiltered.filter(
        (s) => levelFilter === "TODOS" || getStockLevel(s.quantity, s.minStock) === levelFilter
      ),
    [searchFiltered, levelFilter]
  );

  async function refresh() {
    const res = await fetch("/api/stock");
    if (res.ok) setItems(await res.json());
  }

  async function refreshCategories() {
    const res = await fetch("/api/categories");
    if (res.ok) setCategories(await res.json());
    // Renomear categoria também atualiza o texto em itens já cadastrados no servidor.
    refresh();
  }

  function openEdit(item: StockItemDTO) {
    setEditing(item);
    setShowModal(true);
  }

  function requestDelete(item: StockItemDTO) {
    setError(null);
    setConfirmDeleteTarget(item);
  }

  async function confirmDelete() {
    const item = confirmDeleteTarget;
    if (!item) return;
    setError(null);
    setDeletingId(item.id);
    try {
      const res = await fetch(`/api/stock/${item.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível excluir o item.");
      setItems((prev) => prev.filter((s) => s.id !== item.id));
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
        title="Estoque"
        description="Itens cadastrados, saldos e localização física"
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowCategoryManager(true)}>
              <Settings2 size={16} /> Gerenciar categorias
            </Button>
            <Button
              onClick={() => {
                setEditing(undefined);
                setShowModal(true);
              }}
            >
              <Plus size={16} /> Novo item
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          placeholder="Buscar por nome, código ou categoria..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <ViewToggle view={view} onChange={changeView} />
      </div>

      <StockLevelFilter value={levelFilter} onChange={setLevelFilter} counts={levelCounts} />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {view === "grid" ? (
        <StockCardGrid items={filtered} onEdit={openEdit} onDelete={requestDelete} deletingId={deletingId} />
      ) : (
        <StockListView items={filtered} onEdit={openEdit} onDelete={requestDelete} deletingId={deletingId} />
      )}

      {showModal && (
        <StockModal
          item={editing}
          categories={categories}
          onClose={() => {
            setShowModal(false);
            setEditing(undefined);
          }}
          onSaved={refresh}
        />
      )}
      {showCategoryManager && (
        <CategoryManagerModal
          categories={categories}
          onClose={() => setShowCategoryManager(false)}
          onChanged={refreshCategories}
        />
      )}

      {confirmDeleteTarget && (
        <ConfirmDialog
          title="Excluir item"
          message={`Excluir "${confirmDeleteTarget.name}" (${confirmDeleteTarget.code})? Essa ação não pode ser desfeita.`}
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
