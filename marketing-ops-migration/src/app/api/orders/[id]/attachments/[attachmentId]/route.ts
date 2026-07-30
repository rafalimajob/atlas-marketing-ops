import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/require-admin";
import { logHistory } from "@/lib/history";

type RouteContext = { params: Promise<{ id: string; attachmentId: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const gate = await requireWriteAccess();
  if ("error" in gate) return gate.error;
  const { session } = gate;

  const { id: orderId, attachmentId } = await params;
  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!attachment || attachment.orderId !== orderId) {
    return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
  }

  await prisma.attachment.delete({ where: { id: attachmentId } });

  if (attachment.url.startsWith("/uploads/")) {
    await unlink(path.join(process.cwd(), "public", attachment.url)).catch(() => {});
  }

  try {
    await logHistory({
      action: "UPDATE",
      entity: "ORDER",
      entityId: orderId,
      summary: `Anexo "${attachment.filename}" removido do pedido`,
      userId: session.user.id,
    });
  } catch (err) {
    console.error("Falha ao gravar HistoryLog:", err);
  }

  return NextResponse.json({ ok: true });
}
