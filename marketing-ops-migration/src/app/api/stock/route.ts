import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/require-admin";
import { logHistory } from "@/lib/history";
import { toErrorResponse } from "@/lib/api-errors";

async function nextStockCode(): Promise<string> {
  const last = await prisma.stockItem.findFirst({ orderBy: { code: "desc" }, select: { code: true } });
  const lastNum = last ? parseInt(last.code.replace("MKT-", ""), 10) || 0 : 0;
  return `MKT-${String(lastNum + 1).padStart(4, "0")}`;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q")?.trim();
  const items = await prisma.stockItem.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { category: { contains: q, mode: "insensitive" } },
            { code: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: { updatedBy: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const gate = await requireWriteAccess();
  if ("error" in gate) return gate.error;
  const { session } = gate;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const category = typeof body?.category === "string" ? body.category.trim() : "";
  if (!name || !category) {
    return NextResponse.json({ error: "Nome e categoria são obrigatórios." }, { status: 400 });
  }

  const quantity = Number(body?.quantity) || 0;
  const minStock = Number(body?.minStock) || 0;
  const idealStock = Number(body?.idealStock) || 0;
  const lastCost = body?.lastCost != null && body.lastCost !== "" ? Number(body.lastCost) : null;
  const lastPurchaseDate = body?.lastPurchaseDate ? new Date(body.lastPurchaseDate) : null;
  const location = typeof body?.location === "string" ? body.location.trim() || null : null;

  try {
    const code = await nextStockCode();
    const item = await prisma.stockItem.create({
      data: {
        code,
        name,
        category,
        quantity,
        minStock,
        idealStock,
        lastCost,
        lastPurchaseDate,
        location,
        createdById: session.user.id,
        updatedById: session.user.id,
      },
    });

    await logHistory({
      action: "CREATE",
      entity: "STOCK_ITEM",
      entityId: item.id,
      summary: `Item de estoque ${item.code} (${item.name}) cadastrado`,
      userId: session.user.id,
    });

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    const { message, status } = toErrorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }
}
