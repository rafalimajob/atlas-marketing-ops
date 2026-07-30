import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { Prisma } from "@/generated/prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const DEFAULT_TAKE = 20;
const MAX_TAKE = 50;

/**
 * Histórico de saídas de um kit, paginado e filtrável por período — usado
 * pelo modal "Ver saídas" (só ADMIN). Deliberadamente não vem embutido no
 * GET /api/kits (que só traz a contagem via `_count`), para essa lista não
 * crescer sem limite conforme o volume de saídas registradas ao longo do
 * tempo.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;

  const { id: kitId } = await params;
  const { searchParams } = request.nextUrl;

  const skip = Math.max(0, Number(searchParams.get("skip")) || 0);
  const take = Math.min(MAX_TAKE, Math.max(1, Number(searchParams.get("take")) || DEFAULT_TAKE));
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const dateFilter: Prisma.KitOutputWhereInput["date"] = {};
  if (from) dateFilter.gte = new Date(`${from}T00:00:00.000Z`);
  if (to) dateFilter.lte = new Date(`${to}T23:59:59.999Z`);

  const where: Prisma.KitOutputWhereInput = {
    kitId,
    ...(from || to ? { date: dateFilter } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.kitOutput.findMany({
      where,
      orderBy: { date: "desc" },
      skip,
      take,
      include: {
        performedBy: { select: { name: true } },
        movements: { take: 1, select: { area: { select: { id: true, name: true } } } },
      },
    }),
    prisma.kitOutput.count({ where }),
  ]);

  return NextResponse.json({
    items: items.map((o) => ({
      id: o.id,
      quantity: o.quantity,
      project: o.project,
      notes: o.notes,
      date: o.date.toISOString(),
      performedBy: o.performedBy,
      area: o.movements[0]?.area ?? null,
    })),
    total,
  });
}
