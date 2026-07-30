import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildXlsxBuffer, REPORT_TYPES, type ReportType } from "@/lib/reports";
import { ORDER_STATUS_VALUES, ORDER_STATUS_LABEL } from "@/lib/order-status";
import { MOVEMENT_TYPE_LABEL } from "@/lib/movement-types";
import type { MovementTypeValue } from "@/lib/movement-types";
import type { OrderStatusValue } from "@/lib/order-status";

type RouteContext = { params: Promise<{ type: string }> };

const fmt = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

function dateRangeFilter(from: string | null, to: string | null) {
  if (!from && !to) return undefined;
  const range: { gte?: Date; lte?: Date } = {};
  if (from) range.gte = new Date(`${from}T00:00:00.000Z`);
  if (to) range.lte = new Date(`${to}T23:59:59.999Z`);
  return range;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { type } = await params;
  if (!REPORT_TYPES.includes(type as ReportType)) {
    return NextResponse.json({ error: "Relatório inválido." }, { status: 404 });
  }
  const reportType = type as ReportType;

  const { searchParams } = request.nextUrl;
  // Mesmo intervalo aplicado tanto a `Order.requestDate` quanto a
  // `Movement.date` — cada relatório usa a que faz sentido para seus dados.
  const dateFilter = dateRangeFilter(searchParams.get("from"), searchParams.get("to"));

  let headers: string[] = [];
  let rows: (string | number)[][] = [];

  if (reportType === "pedidos-por-status") {
    const orders = await prisma.order.findMany({
      where: { requestDate: dateFilter },
      select: { status: true },
    });
    headers = ["Status", "Quantidade"];
    rows = ORDER_STATUS_VALUES.map((s) => [
      ORDER_STATUS_LABEL[s],
      orders.filter((o) => o.status === s).length,
    ]);
  } else if (reportType === "pedidos") {
    const orders = await prisma.order.findMany({
      where: { requestDate: dateFilter },
      include: { stockItem: { select: { name: true } } },
      orderBy: { requestDate: "desc" },
    });
    headers = ["Item", "Quantidade", "OC", "Projeto", "Status", "Solicitação", "Previsão", "Entrega"];
    rows = orders.map((o) => [
      o.stockItem.name,
      o.quantity,
      o.ocNumber,
      o.project,
      ORDER_STATUS_LABEL[o.status as OrderStatusValue],
      fmt(o.requestDate),
      fmt(o.expectedDate),
      fmt(o.deliveredDate),
    ]);
  } else if (reportType === "pedidos-por-projeto") {
    const orders = await prisma.order.findMany({
      where: { requestDate: dateFilter },
      select: { project: true },
    });
    const map = new Map<string, number>();
    for (const o of orders) map.set(o.project, (map.get(o.project) ?? 0) + 1);
    headers = ["Projeto", "Quantidade"];
    rows = [...map.entries()];
  } else if (reportType === "estoque") {
    const stock = await prisma.stockItem.findMany({ orderBy: { name: "asc" } });
    headers = ["Código", "Nome", "Categoria", "Quantidade", "Mínimo", "Ideal", "Local"];
    rows = stock.map((s) => [s.code, s.name, s.category, s.quantity, s.minStock, s.idealStock, s.location ?? ""]);
  } else if (reportType === "itens-criticos") {
    const stock = await prisma.stockItem.findMany({ orderBy: { name: "asc" } });
    headers = ["Código", "Nome", "Quantidade", "Mínimo"];
    rows = stock.filter((s) => s.quantity < s.minStock).map((s) => [s.code, s.name, s.quantity, s.minStock]);
  } else if (reportType === "movimentacoes") {
    const movements = await prisma.movement.findMany({
      where: { date: dateFilter },
      include: { stockItem: { select: { name: true } } },
      orderBy: { date: "desc" },
    });
    headers = ["Data", "Tipo", "Item", "Quantidade", "Projeto", "Observação"];
    rows = movements.map((m) => [
      fmt(m.date),
      MOVEMENT_TYPE_LABEL[m.type as MovementTypeValue],
      m.stockItem.name,
      m.direction === "ENTRADA" ? m.quantity : -m.quantity,
      m.project ?? "",
      m.notes ?? "",
    ]);
  } else if (reportType === "consumo-por-projeto") {
    const movements = await prisma.movement.findMany({
      where: { direction: "SAIDA", date: dateFilter },
      select: { project: true, quantity: true },
    });
    const map = new Map<string, number>();
    for (const m of movements) {
      const project = m.project || "Outros";
      map.set(project, (map.get(project) ?? 0) + m.quantity);
    }
    headers = ["Projeto", "Quantidade consumida"];
    rows = [...map.entries()];
  } else if (reportType === "consumo-por-area") {
    const movements = await prisma.movement.findMany({
      where: { areaId: { not: null }, date: dateFilter },
      include: { area: { select: { name: true } } },
    });
    const map = new Map<string, { qty: number; value: number }>();
    for (const m of movements) {
      const area = m.area?.name ?? "Sem área";
      const entry = map.get(area) ?? { qty: 0, value: 0 };
      entry.qty += m.quantity;
      entry.value += m.totalCost ? Number(m.totalCost) : 0;
      map.set(area, entry);
    }
    headers = ["Área", "Quantidade consumida", "Valor consumido (R$)"];
    rows = [...map.entries()].map(([area, { qty, value }]) => [area, qty, Number(value.toFixed(2))]);
  }

  const buffer = await buildXlsxBuffer(REPORT_LABEL_SAFE(reportType), headers, rows);
  const filename = `${reportType}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function REPORT_LABEL_SAFE(type: ReportType): string {
  // Nome da planilha não pode passar de 31 caracteres nem ter certos símbolos.
  return type.slice(0, 31);
}
