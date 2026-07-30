"use client";

import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DateRangeFilter, ALL_TIME_RANGE } from "@/components/ui/date-range-filter";
import { REPORT_TYPES, REPORT_LABEL, REPORTS_WITHOUT_PERIOD } from "@/lib/reports";

export function ReportsList() {
  const [range, setRange] = useState(ALL_TIME_RANGE);

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">Período</div>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Aplica-se aos relatórios com data própria (Pedidos, Movimentações, Consumo). &ldquo;Estoque
          atual&rdquo; e &ldquo;Itens abaixo do mínimo&rdquo; sempre refletem o saldo neste momento,
          não um período.
        </p>
        <DateRangeFilter value={range} onChange={setRange} />
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {REPORT_TYPES.map((type) => {
          const usesPeriod = !REPORTS_WITHOUT_PERIOD.has(type);
          const params = new URLSearchParams();
          if (usesPeriod) {
            if (range.from) params.set("from", range.from);
            if (range.to) params.set("to", range.to);
          }
          const query = params.toString();
          const href = `/api/reports/${type}${query ? `?${query}` : ""}`;

          return (
            <Card key={type} className="flex items-center justify-between gap-3 transition-shadow hover:shadow-md">
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-ok/10 text-brand-ok">
                  <FileSpreadsheet size={18} />
                </span>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {REPORT_LABEL[type]}
                  {!usesPeriod && <span className="ml-1.5 text-xs font-normal text-zinc-400">(estado atual)</span>}
                </span>
              </span>
              <a
                href={href}
                download
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-sm font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Download size={14} /> Exportar
              </a>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
