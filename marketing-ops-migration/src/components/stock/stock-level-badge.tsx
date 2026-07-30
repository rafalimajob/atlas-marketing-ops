import { Badge } from "@/components/ui/badge";
import { CHART_COLORS } from "@/lib/theme-colors";
import { getStockLevel, STOCK_LEVEL_LABEL } from "@/lib/stock-level";

export function StockLevelBadge({ quantity, minStock }: { quantity: number; minStock: number }) {
  const level = getStockLevel(quantity, minStock);
  return <Badge color={CHART_COLORS[level]}>{STOCK_LEVEL_LABEL[level]}</Badge>;
}
