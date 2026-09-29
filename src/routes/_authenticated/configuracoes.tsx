import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useAttendance";
import { AdminOnly } from "@/components/AdminOnly";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Ponto Certo" }] }),
  component: () => (
    <AdminOnly>
      <Configuracoes />
    </AdminOnly>
  ),
});

function Configuracoes() {
  const { user, profile, company } = useAuth();
  const qc = useQueryClient();
  const { data } = useSettings();
  const [form, setForm] = useState({ name: "", cnpj: "", overtime_50: 50, overtime_100: 100, tolerance_minutes: 10 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data || company)
      setForm((f) => ({
        ...f,
        name: company?.name ?? data?.name ?? "Minha Empresa",
        cnpj: company?.cnpj ?? "",
        overtime_50: data?.overtime_50 ?? 50,
        overtime_100: data?.overtime_100 ?? 100,
        tolerance_minutes: data?.tolerance_minutes ?? 10,
      }));
  }, [data, company]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Informe o nome da empresa."); return; }
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        {
          key: "company",
          company_id: company?.id as string,
          value: { ...form, name: form.name.trim() },
        },
        { onConflict: "company_id,key" },
      );
    if (!error && company) {
      await supabase
        .from("companies")
        .update({ name: form.name.trim(), cnpj: form.cnpj.trim() || null })
        .eq("id", company.id);
    }
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar."); return; }
    if (user)
      await logAudit({ actorId: user.id, actorName: profile?.full_name ?? "", action: "settings_updated", entity: "settings", entityId: "company", details: form });
    qc.invalidateQueries({ queryKey: ["settings"] });
    qc.invalidateQueries({ queryKey: ["me"] });
    toast.success("Configurações salvas.");
  }

  const num = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: Number(e.target.value) }));

  return (
    <div className="max-w-2xl">
      <PageHeader title="Configurações" description="Dados da empresa e regras de cálculo." />
      <Card className="shadow-card">
        <CardContent className="p-6">
          <form onSubmit={save} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da empresa</Label>
              <Input id="name" maxLength={120} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Aparece no menu e no cabeçalho dos relatórios em PDF.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ (opcional)</Label>
              <Input id="cnpj" maxLength={20} placeholder="00.000.000/0001-00" value={form.cnpj} onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="o50">Hora extra dias úteis (%)</Label>
                <Input id="o50" type="number" min={0} max={200} value={form.overtime_50} onChange={num("overtime_50")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="o100">Hora extra feriados (%)</Label>
                <Input id="o100" type="number" min={0} max={300} value={form.overtime_100} onChange={num("overtime_100")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tol">Tolerância (min)</Label>
                <Input id="tol" type="number" min={0} max={60} value={form.tolerance_minutes} onChange={num("tolerance_minutes")} />
              </div>
            </div>
            <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
