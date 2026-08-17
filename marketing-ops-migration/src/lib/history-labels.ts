import type { HistoryAction, HistoryEntity } from "@/generated/prisma/client";
import { CHART_COLORS } from "@/lib/theme-colors";

export const HISTORY_ENTITY_LABEL: Record<HistoryEntity, string> = {
  ORDER: "Pedido",
  STOCK_ITEM: "Item de estoque",
  MOVEMENT: "Movimentação",
  KIT: "Kit",
  AREA: "Área",
  USER: "Usuário",
  CATEGORY: "Categoria",
};

export const HISTORY_ACTION_LABEL: Record<HistoryAction, string> = {
  CREATE: "Criação",
  UPDATE: "Atualização",
  DELETE: "Exclusão",
};

/** Verde para criação, âmbar para atualização, vermelho para exclusão — mesma
 * convenção semântica de ok/warn/crit usada nas outras badges do app. */
export const HISTORY_ACTION_COLOR: Record<HistoryAction, string> = {
  CREATE: CHART_COLORS.ok,
  UPDATE: CHART_COLORS.warn,
  DELETE: CHART_COLORS.crit,
};
