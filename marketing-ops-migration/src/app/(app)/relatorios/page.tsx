import { PageHeader } from "@/components/ui/page-header";
import { ReportsList } from "@/components/reports/reports-list";

export default function RelatoriosPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Relatórios"
        description="Exportação em Excel (.xlsx), pronta para abrir direto ou importar em outras planilhas."
      />
      <ReportsList />
    </div>
  );
}
