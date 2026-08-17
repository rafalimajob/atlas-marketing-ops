import type { HistoryAction, HistoryEntity } from "@/generated/prisma/client";

export interface HistoryLogDTO {
  id: string;
  timestamp: string;
  action: HistoryAction;
  entity: HistoryEntity;
  entityId: string;
  summary: string;
  diff: Record<string, { before: unknown; after: unknown }> | null;
  user: { id: string; name: string } | null;
}
