import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/require-admin";
import { Prisma, type HistoryAction, type HistoryEntity } from "@/generated/prisma/client";
import type { HistoryLogDTO } from "@/types/history";

const DEFAULT_TAKE = 20;
const MAX_TAKE = 50;

/**
 * Tela de auditoria (só SUPER_ADMIN) — lê de volta o que `logHistory()`
 * (`src/lib/history.ts`) grava em toda ação relevante. Paginado desde o
 * início: diferente das outras listagens do app (que carregam tudo de uma
 * vez), aqui o volume só cresce, nunca é limpo.
 */
export async function GET(request: NextRequest) {
  const gate = await requireSuperAdmin();
  if ("error" in gate) return gate.error;

  const { searchParams } = request.nextUrl;

  const skip = Math.max(0, Number(searchParams.get("skip")) || 0);
  const take = Math.min(MAX_TAKE, Math.max(1, Number(searchParams.get("take")) || DEFAULT_TAKE));
  const entity = searchParams.get("entity") as HistoryEntity | null;
  const action = searchParams.get("action") as HistoryAction | null;
  const userId = searchParams.get("userId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const timestampFilter: Prisma.HistoryLogWhereInput["timestamp"] = {};
  if (from) timestampFilter.gte = new Date(`${from}T00:00:00.000Z`);
  if (to) timestampFilter.lte = new Date(`${to}T23:59:59.999Z`);

  const where: Prisma.HistoryLogWhereInput = {
    ...(entity ? { entity } : {}),
    ...(action ? { action } : {}),
    ...(userId ? { userId } : {}),
    ...(from || to ? { timestamp: timestampFilter } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.historyLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip,
      take,
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.historyLog.count({ where }),
  ]);

  const dto: HistoryLogDTO[] = items.map((log) => ({
    id: log.id,
    timestamp: log.timestamp.toISOString(),
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    summary: log.summary,
    diff: log.diff as HistoryLogDTO["diff"],
    user: log.user,
  }));

  return NextResponse.json({ items: dto, total });
}
