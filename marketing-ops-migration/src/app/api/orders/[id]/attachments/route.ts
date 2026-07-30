import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/require-admin";
import { logHistory } from "@/lib/history";

type RouteContext = { params: Promise<{ id: string }> };

const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15MB — upload local de dev, ajustar ao trocar por Blob/S3

// Upload local em /public/uploads (dev only, ver README). Em produção, trocar por
// Vercel Blob/S3 preenchendo BLOB_READ_WRITE_TOKEN e adaptando esta rota.
export async function POST(request: NextRequest, { params }: RouteContext) {
  const gate = await requireWriteAccess();
  if ("error" in gate) return gate.error;
  const { session } = gate;

  const { id: orderId } = await params;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Arquivo maior que 15MB." }, { status: 400 });
  }

  const ext = path.extname(file.name).slice(0, 20);
  const storedName = `${randomBytes(16).toString("hex")}${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", orderId);
  await mkdir(dir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, storedName), buffer);

  const attachment = await prisma.attachment.create({
    data: {
      orderId,
      filename: file.name,
      url: `/uploads/${orderId}/${storedName}`,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    },
  });

  try {
    await logHistory({
      action: "UPDATE",
      entity: "ORDER",
      entityId: orderId,
      summary: `Anexo "${attachment.filename}" adicionado ao pedido (OC ${order.ocNumber})`,
      userId: session.user.id,
    });
  } catch (err) {
    console.error("Falha ao gravar HistoryLog:", err);
  }

  return NextResponse.json(attachment, { status: 201 });
}
