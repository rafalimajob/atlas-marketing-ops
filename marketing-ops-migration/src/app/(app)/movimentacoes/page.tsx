import { prisma } from "@/lib/prisma";
import { MovementTable } from "@/components/movements/movement-table";
import type { MovementDTO, StockOptionDTO } from "@/types/movement";
import type { MovementTypeValue } from "@/lib/movement-types";

export default async function MovimentacoesPage() {
  const [movements, stock] = await Promise.all([
    prisma.movement.findMany({
      include: { stockItem: { select: { name: true, code: true } }, performedBy: { select: { name: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.stockItem.findMany({ select: { id: true, code: true, name: true, quantity: true }, orderBy: { name: "asc" } }),
  ]);

  const dtoMovements: MovementDTO[] = movements.map((m) => ({
    id: m.id,
    date: m.date.toISOString(),
    direction: m.direction,
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
  }));

  const stockOptions: StockOptionDTO[] = stock;

  return <MovementTable initialMovements={dtoMovements} stock={stockOptions} />;
}
