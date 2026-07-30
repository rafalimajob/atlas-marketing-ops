import { Edit2, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StockLevelBadge } from "@/components/stock/stock-level-badge";
import type { StockItemDTO } from "@/types/stock";

export function StockCardGrid({
  items,
  onEdit,
  onDelete,
  deletingId,
}: {
  items: StockItemDTO[];
  onEdit?: (item: StockItemDTO) => void;
  onDelete?: (item: StockItemDTO) => void;
  deletingId: string | null;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((s) => (
        <Card key={s.id}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-xs text-zinc-400">
                {s.code} · {s.category}
              </div>
              <div className="truncate font-medium text-zinc-900 dark:text-zinc-50">{s.name}</div>
            </div>
            {(onEdit || onDelete) && (
              <div className="flex shrink-0 gap-1">
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(s)}
                    className="text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
                    aria-label="Editar"
                  >
                    <Edit2 size={14} />
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(s)}
                    disabled={deletingId === s.id}
                    className="text-brand-crit hover:opacity-70 disabled:opacity-40"
                    aria-label="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mt-3 flex items-end justify-between">
            <div>
              <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{s.quantity}</div>
              <div className="text-xs text-zinc-400">
                mín. {s.minStock} · ideal {s.idealStock}
              </div>
            </div>
            <StockLevelBadge quantity={s.quantity} minStock={s.minStock} />
          </div>

          <div className="mt-3 flex justify-between border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <span>Local: {s.location ?? "—"}</span>
            <span>Últ. custo: {s.lastCost ? `R$ ${Number(s.lastCost).toFixed(2)}` : "—"}</span>
          </div>
          {s.updatedBy?.name && (
            <div className="mt-1 text-xs text-zinc-400">Última alteração: {s.updatedBy.name}</div>
          )}
        </Card>
      ))}
      {items.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhum item encontrado.</p>}
    </div>
  );
}
