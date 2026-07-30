import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logHistory } from "@/lib/history";
import { toErrorResponse } from "@/lib/api-errors";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const kits = await prisma.kit.findMany({
    include: { items: { include: { stockItem: { select: { name: true, code: true, lastCost: true } } } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(kits);
}

interface KitItemInput {
  stockItemId: string;
  quantity: number;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const items: KitItemInput[] = Array.isArray(body?.items)
    ? body.items
        .filter((i: unknown): i is KitItemInput => {
          const item = i as Partial<KitItemInput>;
          return typeof item?.stockItemId === "string" && Number(item.quantity) > 0;
        })
        .map((i: KitItemInput) => ({ stockItemId: i.stockItemId, quantity: Number(i.quantity) }))
    : [];

  if (!name) return NextResponse.json({ error: "Nome do kit é obrigatório." }, { status: 400 });
  if (items.length === 0) return NextResponse.json({ error: "Adicione ao menos um item ao kit." }, { status: 400 });

  const uniqueStockItemIds = new Set(items.map((i) => i.stockItemId));
  if (uniqueStockItemIds.size !== items.length) {
    return NextResponse.json({ error: "Cada item só pode aparecer uma vez no kit." }, { status: 400 });
  }

  try {
    const kit = await prisma.kit.create({
      data: {
        name,
        items: { create: items.map((i) => ({ stockItemId: i.stockItemId, quantity: i.quantity })) },
      },
      include: { items: { include: { stockItem: { select: { name: true, code: true, lastCost: true } } } } },
    });

    await logHistory({
      action: "CREATE",
      entity: "KIT",
      entityId: kit.id,
      summary: `Kit "${kit.name}" cadastrado com ${items.length} item(ns)`,
      userId: session.user.id,
    });

    return NextResponse.json(kit, { status: 201 });
  } catch (err) {
    const { message, status } = toErrorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }
}
