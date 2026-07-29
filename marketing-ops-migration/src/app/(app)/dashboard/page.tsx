import { prisma } from "@/lib/prisma";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import type { OrderDTO } from "@/types/order";
import type { MovementDTO } from "@/types/movement";
import type { StockItemDTO } from "@/types/stock";
import type { OrderStatusValue } from "@/lib/order-status";
import type { MovementTypeValue } from "@/lib/movement-types";

export default async function DashboardPage() {
  const [orders, stock, movements] = await Promise.all([
    prisma.order.findMany({ include: { stockItem: { select: { name: true, code: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.stockItem.findMany({ orderBy: { name: "asc" } }),
    prisma.movement.findMany({
      include: { stockItem: { select: { name: true, code: true } }, performedBy: { select: { name: true } } },
      orderBy: { date: "desc" },
    }),
  ]);

  const dtoOrders: OrderDTO[] = orders.map((o) => ({
    id: o.id,
    stockItemId: o.stockItemId,
    stockItem: o.stockItem,
    quantity: o.quantity,
    ocNumber: o.ocNumber,
    project: o.project,
    status: o.status as OrderStatusValue,
    requestDate: o.requestDate.toISOString(),
    expectedDate: o.expectedDate ? o.expectedDate.toISOString() : null,
    deliveredDate: o.deliveredDate ? o.deliveredDate.toISOString() : null,
    notes: o.notes,
    attachments: [],
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  }));

  const dtoStock: StockItemDTO[] = stock.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    category: s.category,
    photoUrl: s.photoUrl,
    quantity: s.quantity,
    minStock: s.minStock,
    idealStock: s.idealStock,
    lastCost: s.lastCost ? s.lastCost.toString() : null,
    lastPurchaseDate: s.lastPurchaseDate ? s.lastPurchaseDate.toISOString() : null,
    location: s.location,
    createdById: s.createdById,
    updatedById: s.updatedById,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  const dtoMovements: MovementDTO[] = movements.map((m) => ({
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
  }));

  return <DashboardClient orders={dtoOrders} stock={dtoStock} movements={dtoMovements} />;
}
