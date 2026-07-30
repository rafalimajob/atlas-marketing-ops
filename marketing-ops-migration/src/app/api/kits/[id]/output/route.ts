import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registerKitOutput } from "@/lib/movements";
import { logHistory } from "@/lib/history";
import { toErrorResponse } from "@/lib/api-errors";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id: kitId } = await params;
  const kit = await prisma.kit.findUnique({ where: { id: kitId } });
  if (!kit) return NextResponse.json({ error: "Kit não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const quantity = Number(body?.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Quantidade de kits precisa ser maior que zero." }, { status: 400 });
  }

  const areaId = typeof body?.areaId === "string" ? body.areaId : "";
  if (!areaId) return NextResponse.json({ error: "Selecione uma área para a retirada." }, { status: 400 });

  const area = await prisma.area.findUnique({ where: { id: areaId } });
  if (!area) return NextResponse.json({ error: "Área não encontrada." }, { status: 404 });

  try {
    const kitOutput = await registerKitOutput({
      kitId,
      quantity,
      areaId,
      project: typeof body?.project === "string" ? body.project.trim() : null,
      notes: typeof body?.notes === "string" ? body.notes.trim() : null,
      performedById: session.user.id,
    });

    await logHistory({
      action: "CREATE",
      entity: "KIT",
      entityId: kitId,
      summary: `Saída de ${quantity}x kit "${kit.name}" pela área "${area.name}"`,
      userId: session.user.id,
    });

    return NextResponse.json(kitOutput, { status: 201 });
  } catch (err) {
    const { message, status } = toErrorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }
}
