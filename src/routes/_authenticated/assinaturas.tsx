import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { isPlatformAdmin, listSubscriptions } from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/assinaturas")({
  head: () => ({
    meta: [
      { title: "Assinaturas — ID Point" },
      { name: "description", content: "Acompanhe empresas, planos, status e vencimentos." },
      { property: "og:title", content: "Assinaturas — ID Point" },
      { property: "og:description", content: "Acompanhe empresas, planos, status e vencimentos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssinaturasPage,
});

const PLAN_LABEL: Record<string, string> = { start: "Start", pro: "Pro", enterprise: "Enterprise" };

function fmtDate(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function daysUntil(v: string | null) {
  if (!v) return null;
  return Math.ceil((new Date(v).getTime() - Date.now()) / 86400000);
}

function AssinaturasPage() {
  const checkFn = useServerFn(isPlatformAdmin);
  const listFn = useServerFn(listSubscriptions);
  const [q, setQ] = useState("");
  const check = useQuery({ queryKey: ["platform-admin"], queryFn: () => checkFn() });
  const list = useQuery({
    queryKey: ["subscriptions"],
    enabled: check.data?.ok === true,
    queryFn: () => listFn(),
  });

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (list.data ?? []).filter(
      (r) => !t || r.name.toLowerCase().includes(t) || (r.billing_email ?? "").toLowerCase().includes(t),
    );
  }, [list.data, q]);

  if (check.isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!check.data?.ok)
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border p-10 text-center">
        <ShieldAlert className="h-8 w-8 text-destructive" />
        <p className="font-semibold">Acesso restrito ao dono da plataforma.</p>
      </div>
    );

  const all = list.data ?? [];
  const ativas = all.filter((r) => r.active).length;
  const vencendo = all.filter((r) => {
    const d = daysUntil(r.current_period_end);
    return r.active && d !== null && d <= 7;
  }).length;

  return (
    <div>
      <PageHeader title="Assinaturas" description="Todas as empresas clientes do ID Point." />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          ["Empresas", all.length],
          ["Ativas", ativas],
          ["Vencem em até 7 dias", vencendo],
        ].map(([l, v]) => (
          <div key={l as string} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className="text-2xl font-extrabold">{v}</p>
          </div>
        ))}
      </div>
      <Input
        placeholder="Buscar por empresa ou e-mail…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-4 max-w-sm"
      />
      {list.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : list.error ? (
        <p className="text-sm text-destructive">{(list.error as Error).message}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3">Empresa</th>
                <th className="p-3">Plano</th>
                <th className="p-3">Funcionários</th>
                <th className="p-3">Status</th>
                <th className="p-3">Próximo vencimento</th>
                <th className="p-3">Cliente desde</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const d = daysUntil(r.current_period_end);
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-3">
                      <p className="font-semibold">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.billing_email ?? r.cnpj ?? ""}</p>
                    </td>
                    <td className="p-3">{PLAN_LABEL[r.plan] ?? r.plan}</td>
                    <td className="p-3 font-mono">
                      {r.employees}/{r.max_employees}
                    </td>
                    <td className="p-3">
                      {r.active ? <Badge>Ativa</Badge> : <Badge variant="destructive">Suspensa</Badge>}
                    </td>
                    <td className="p-3">
                      {fmtDate(r.current_period_end)}
                      {d !== null && r.active && (
                        <span className={d <= 7 ? "ml-2 text-xs text-destructive" : "ml-2 text-xs text-muted-foreground"}>
                          {d < 0 ? `vencida há ${-d}d` : `em ${d}d`}
                        </span>
                      )}
                    </td>
                    <td className="p-3">{fmtDate(r.created_at)}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    Nenhuma empresa encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
