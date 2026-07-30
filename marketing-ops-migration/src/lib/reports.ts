import ExcelJS from "exceljs";

export const REPORT_TYPES = [
  "pedidos-por-status",
  "pedidos",
  "pedidos-por-projeto",
  "estoque",
  "itens-criticos",
  "movimentacoes",
  "consumo-por-projeto",
  "consumo-por-area",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_LABEL: Record<ReportType, string> = {
  "pedidos-por-status": "Pedidos por status",
  pedidos: "Pedidos por período",
  "pedidos-por-projeto": "Pedidos por Projeto/Campanha",
  estoque: "Estoque atual",
  "itens-criticos": "Itens abaixo do estoque mínimo",
  movimentacoes: "Histórico de movimentações",
  "consumo-por-projeto": "Consumo por Projeto/Campanha",
  "consumo-por-area": "Consumo por Área",
};

// "Estoque atual" e "Itens abaixo do mínimo" são um retrato do saldo agora —
// não existe "o estoque de tal período", só o saldo no momento da consulta.
// Os demais relatórios têm uma data própria (requestDate do pedido ou date da
// movimentação) e por isso respeitam o filtro de período da tela.
export const REPORTS_WITHOUT_PERIOD: ReadonlySet<ReportType> = new Set(["estoque", "itens-criticos"]);

export async function buildXlsxBuffer(sheetName: string, headers: string[], rows: (string | number)[][]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = headers.map((header) => ({ header, key: header, width: Math.max(header.length + 4, 16) }));
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) sheet.addRow(row);
  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
