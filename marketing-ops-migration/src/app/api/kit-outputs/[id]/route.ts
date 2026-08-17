import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { returnKitOutputQuantity } from "@/lib/movements";
import { logHistory } from "@/lib/history";
import { toErrorResponse } from "@/lib/api-errors";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Devolve ao estoque a quantidade informada em `?quantity=` (em kits) de uma
 * saída já registrada — sem o parâmetro, devolve a saída inteira (mesmo
 * comportamento de antes, quando só existia desfazer tudo).
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { session } = gate;

  const { id } = await params;
  const existing = await prisma.kitOutput.findUnique({
    where: { id },
    include: { kit: { select: { id: true, name: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Saída de kit não encontrada." }, { status: 404 });

  const quantityParam = request.nextUrl.searchParams.get("quantity");
  const returnQuantity = quantityParam ? Number(quantityParam) : existing.quantity;

  let result: Awaited<ReturnType<typeof returnKitOutputQuantity>>;
  try {
    result = await returnKitOutputQuantity(id, returnQuantity, session.user.id);
  } catch (err) {
    const { message, status } = toErrorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }

  try {
    await logHistory({
      action: result.isFullReturn ? "DELETE" : "UPDATE",
      entity: "KIT",
      entityId: existing.kit.id,
      summary: result.isFullReturn
        ? `Saída de ${existing.quantity}x kit "${existing.kit.name}" desfeita — estoque restaurado`
        : `Devolução parcial de ${returnQuantity}x kit "${existing.kit.name}" (de ${existing.quantity} retirados) — estoque restaurado`,
      userId: session.user.id,
    });
  } catch (err) {
    console.error("Falha ao gravar HistoryLog:", err);
  }

  return NextResponse.json({ ok: true, remainingQuantity: result.remainingQuantity });
}
