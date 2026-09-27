import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminOnly } from "@/components/AdminOnly";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/time-utils";

export const Route = createFileRoute("/_authenticated/auditoria")({
  head: () => ({ meta: [{ title: "Log de auditoria — Ponto Certo" }] }),
  component: () => (
    <AdminOnly>
      <Auditoria />
    </AdminOnly>
  ),
});

const ACTIONS: Record<string, string> = {
  employee_created: "Funcionário criado", employee_updated: "Funcionário alterado", employee_deleted: "Funcionário excluído",
  password_reset: "Senha redefinida", holiday_created: "Feriado criado", holiday_deleted: "Feriado excluído",
  month_closed: "Mês fechado", month_reopened: "Mês reaberto", settings_updated: "Configurações alteradas",
  ai_review: "Revisão com IA", punch: "Marcação de ponto",
};

function Auditoria() {
  const [search, setSearch] = useState("");
  const { data = [], isLoading } = useQuery({
    queryKey: ["audit_logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
  const list = data.filter((l) => `${l.actor_name ?? ""} ${l.action} ${ACTIONS[l.action] ?? ""} ${JSON.stringify(l.details)}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader title="Log de auditoria" description="Últimas 500 ações registradas no sistema." actions={<Input placeholder="Buscar…" className="w-48" value={search} onChange={(e) => setSearch(e.target.value)} />} />
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader><TableRow><TableHead>Data/hora</TableHead><TableHead>Usuário</TableHead><TableHead>Ação</TableHead><TableHead>Detalhes</TableHead></TableRow></TableHeader>
          <TableBody>
            {list.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="whitespace-nowrap text-clock text-xs">{formatDateTime(l.created_at)}</TableCell>
                <TableCell>{l.actor_name || "—"}</TableCell>
                <TableCell><Badge variant="secondary">{ACTIONS[l.action] ?? l.action}</Badge></TableCell>
                <TableCell className="max-w-md text-xs text-muted-foreground">
                  {Object.entries((l.details ?? {}) as Record<string, unknown>).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ") || "—"}
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && list.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum registro.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
