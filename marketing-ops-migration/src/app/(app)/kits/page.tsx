import { prisma } from "@/lib/prisma";
import { KitGrid } from "@/components/kits/kit-grid";
import type { KitDTO } from "@/types/kit";
import type { StockOptionDTO } from "@/types/movement";
import type { AreaDTO } from "@/types/area";

export default async function KitsPage() {
  const [kits, stock, areas] = await Promise.all([
    prisma.kit.findMany({
      include: { items: { include: { stockItem: { select: { name: true, code: true, lastCost: true } } } } },
      orderBy: { name: "asc" },
    }),
    prisma.stockItem.findMany({ select: { id: true, code: true, name: true, quantity: true }, orderBy: { name: "asc" } }),
    prisma.area.findMany({ orderBy: { name: "asc" } }),
  ]);

  const dtoKits: KitDTO[] = kits.map((k) => ({
    id: k.id,
    name: k.name,
    items: k.items.map((i) => ({
      id: i.id,
      stockItemId: i.stockItemId,
      quantity: i.quantity,
      stockItem: {
        name: i.stockItem.name,
        code: i.stockItem.code,
        lastCost: i.stockItem.lastCost ? i.stockItem.lastCost.toString() : null,
      },
    })),
  }));
  const stockOptions: StockOptionDTO[] = stock;
  const areaOptions: AreaDTO[] = areas.map((a) => ({
    id: a.id,
    name: a.name,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }));

  return <KitGrid initialKits={dtoKits} stock={stockOptions} areas={areaOptions} />;
}
