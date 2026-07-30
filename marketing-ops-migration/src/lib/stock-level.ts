export type StockLevel = "crit" | "warn" | "ok";

export const STOCK_LEVEL_LABEL: Record<StockLevel, string> = {
  crit: "Abaixo do mínimo",
  warn: "Próximo do mínimo",
  ok: "Estoque adequado",
};

// Mesmo limiar usado em StockLevelBadge — "próximo do mínimo" é dentro de 30%
// acima do mínimo cadastrado.
export function getStockLevel(quantity: number, minStock: number): StockLevel {
  if (quantity < minStock) return "crit";
  if (quantity < minStock * 1.3) return "warn";
  return "ok";
}
