import { Edit2, Trash2, Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StockLevelBadge } from "@/components/stock/stock-level-badge";
import type { StockItemDTO } from "@/types/stock";

export function StockListView({
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
  const showActions = Boolean(onEdit || onDelete);
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 dark:bg-zinc-800/50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">Item</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">Categoria</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">Quantidade</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">Local</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">Últ. custo</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">Atualizado por</th>
            {showActions && <th className="px-3 py-2" />}
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id} className="border-t border-zinc-100 dark:border-zinc-800">
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
                    <Package size={15} />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-zinc-900 dark:text-zinc-50">{s.name}</div>
                    <div className="truncate text-xs text-zinc-400">{s.code}</div>
                  </div>
                </div>
              </td>
              <td className="px-3 py-2.5 text-zinc-500 dark:text-zinc-400">{s.category}</td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span className="text-zinc-900 dark:text-zinc-50">
                    {s.quantity} <span className="text-zinc-400">(mín. {s.minStock})</span>
                  </span>
                  <span className="shrink-0">
                    <StockLevelBadge quantity={s.quantity} minStock={s.minStock} />
                  </span>
                </div>
              </td>
              <td className="px-3 py-2.5 text-zinc-500 dark:text-zinc-400">{s.location ?? "—"}</td>
              <td className="px-3 py-2.5 text-zinc-500 dark:text-zinc-400">
                {s.lastCost ? `R$ ${Number(s.lastCost).toFixed(2)}` : "—"}
              </td>
              <td className="px-3 py-2.5 text-zinc-500 dark:text-zinc-400">{s.updatedBy?.name ?? "—"}</td>
              {showActions && (
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-2">
                    {onEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(s)}
                        className="text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
                        aria-label="Editar"
                      >
                        <Edit2 size={15} />
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
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={showActions ? 7 : 6} className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Nenhum item encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
