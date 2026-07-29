import { prisma } from "@/lib/prisma";
import { AreaConsumptionView } from "@/components/area-consumption/area-consumption-view";
import type { MovementDTO, StockOptionDTO } from "@/types/movement";
import type { AreaDTO } from "@/types/area";
import type { MovementTypeValue } from "@/lib/movement-types";

export default async function ConsumoAreaPage() {
  const [withdrawals, areas, stock] = await Promise.all([
    prisma.movement.findMany({
      where: { areaId: { not: null } },
      include: {
        stockItem: { select: { name: true, code: true } },
        performedBy: { select: { name: true } },
        area: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
    }),
    prisma.area.findMany({ orderBy: { name: "asc" } }),
    prisma.stockItem.findMany({
      select: { id: true, code: true, name: true, quantity: true, lastCost: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const dtoWithdrawals: MovementDTO[] = withdrawals.map((m) => ({
    id: m.id,
    date: m.date.toISOString(),
    direction: m.direction as "ENTRADA" | "SAIDA",
    type: m.type as MovementTypeValue,
    quantity: m.quantity,
    project: m.project,
    notes: m.notes,
    stockItemId: m.stockItemId,
    stockItem: m.stockItem,
    performedBy: m.performedBy,
    orderId: m.orderId,
    kitOutputId: m.kitOutputId,
    areaId: m.areaId,
    area: m.area,
    unitCost: m.unitCost ? m.unitCost.toString() : null,
    totalCost: m.totalCost ? m.totalCost.toString() : null,
  }));

  const dtoAreas: AreaDTO[] = areas.map((a) => ({
    id: a.id,
    name: a.name,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }));

  const stockOptions: StockOptionDTO[] = stock.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    quantity: s.quantity,
    lastCost: s.lastCost ? s.lastCost.toString() : null,
  }));

  return <AreaConsumptionView initialWithdrawals={dtoWithdrawals} areas={dtoAreas} stock={stockOptions} />;
}
