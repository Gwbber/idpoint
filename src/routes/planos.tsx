import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check, ShieldCheck, Timer } from "lucide-react";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Interval = "monthly" | "yearly";
type PlanKey = "start" | "pro" | "enterprise";
const plans = [
  { key: "start" as const, name: "Start", monthly: "99,90", yearly: "959,04", limit: "Até 10 funcionários", features: ["Registro completo de jornada", "Relatórios em PDF", "Fechamento mensal"] },
  { key: "pro" as const, name: "Pro", monthly: "199,90", yearly: "1.918,80", limit: "Até 50 funcionários", features: ["Tudo do Start", "Análise de inconsistências com IA", "Auditoria e ajustes avançados"], featured: true },
  { key: "enterprise" as const, name: "Enterprise", monthly: "299,90", yearly: "2.878,80", limit: "A partir de 51 funcionários", features: ["Tudo do Pro", "Customizações por empresa", "Atendimento comercial dedicado"] },
];

export const Route = createFileRoute("/planos")({
  component: PlanosPage,
  head: () => ({ meta: [
    { title: "Planos e preços — ID Point" },
    { name: "description", content: "Escolha o plano do ID Point para organizar a jornada e fechar o mês sem planilhas." },
    { property: "og:title", content: "Planos e preços — ID Point" },
    { property: "og:description", content: "Planos de controle de ponto para empresas de todos os tamanhos." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

function digits(value: string) { return value.replace(/\D/g, "").slice(0, 14); }
function PlanosPage() {
  const [interval, setInterval] = useState<Interval>("monthly");
  const [selected, setSelected] = useState<PlanKey | null>(null);
  const [checkout, setCheckout] = useState<Parameters<typeof StripeEmbeddedCheckout>[0]["data"] | null>(null);
  const [form, setForm] = useState({ companyName: "", adminName: "", email: "", cnpj: "" });
  const valid = form.companyName.trim().length >= 2 && form.adminName.trim().length >= 2 && /.+@.+\..+/.test(form.email) && form.cnpj.length === 14;

  return <div className="min-h-screen bg-background">
    <PaymentTestModeBanner />
    <header className="border-b border-border"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
      <Link to="/auth" className="flex items-center gap-2 font-extrabold"><span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground"><Timer className="h-5 w-5" /></span>ID Point</Link>
      <Button asChild variant="ghost"><Link to="/auth"><ArrowLeft className="h-4 w-4" />Entrar</Link></Button>
    </div></header>
    <main className="mx-auto max-w-6xl px-4 py-12">
      <div className="mx-auto max-w-2xl text-center"><p className="text-sm font-semibold text-primary">PLANOS PARA SUA EMPRESA</p><h1 className="mt-3 text-3xl font-extrabold sm:text-5xl">Feche o mês sem planilhas</h1><p className="mt-4 text-muted-foreground">Controle jornadas, ajustes, horas extras e relatórios em um só lugar.</p></div>
      <div className="mx-auto mt-8 flex w-fit rounded-md border border-border bg-muted p-1"><Button size="sm" variant={interval === "monthly" ? "default" : "ghost"} onClick={() => setInterval("monthly")}>Mensal</Button><Button size="sm" variant={interval === "yearly" ? "default" : "ghost"} onClick={() => setInterval("yearly")}>Anual · economize 20%</Button></div>
      <div className="mt-10 grid gap-5 lg:grid-cols-3">{plans.map((plan) => <article key={plan.key} className={`relative rounded-lg border bg-card p-6 ${plan.featured ? "border-primary shadow-glow" : "border-border"}`}>
        {plan.featured && <span className="absolute right-4 top-4 text-xs font-bold text-primary">MAIS ESCOLHIDO</span>}<h2 className="text-xl font-bold">{plan.name}</h2><p className="mt-1 text-sm text-muted-foreground">{plan.limit}</p>
        <p className="mt-6"><span className="text-3xl font-extrabold">R$ {interval === "monthly" ? plan.monthly : plan.yearly}</span><span className="text-muted-foreground">/{interval === "monthly" ? "mês" : "ano"}</span></p>
        {interval === "yearly" && <p className="mt-1 text-xs text-success">Equivale a 10 mensalidades</p>}
        <ul className="my-6 space-y-3">{plan.features.map((f) => <li key={f} className="flex gap-2 text-sm"><Check className="h-4 w-4 shrink-0 text-success" />{f}</li>)}</ul>
        <Button className="w-full" variant={plan.featured ? "default" : "secondary"} onClick={() => { setSelected(plan.key); setCheckout(null); }}>Assinar {plan.name}</Button>
      </article>)}</div>
      <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" />Pagamento protegido. Cancele quando quiser; o acesso continua até o fim do período pago.</p>
    </main>
    <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) { setSelected(null); setCheckout(null); } }}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{checkout ? "Concluir pagamento" : `Assinar plano ${plans.find((p) => p.key === selected)?.name ?? ""}`}</DialogTitle></DialogHeader>
      {checkout ? <div><Button variant="ghost" size="sm" className="mb-3" onClick={() => setCheckout(null)}><ArrowLeft className="h-4 w-4" />Voltar</Button><StripeEmbeddedCheckout data={checkout} /></div> : <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (!selected || !valid) return; setCheckout({ priceId: `${selected}_${interval}` as Parameters<typeof StripeEmbeddedCheckout>[0]["data"]["priceId"], ...form }); }}>
        <div className="space-y-2 sm:col-span-2"><Label htmlFor="company">Nome da empresa</Label><Input id="company" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required /></div>
        <div className="space-y-2"><Label htmlFor="admin">Seu nome</Label><Input id="admin" value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} required /></div>
        <div className="space-y-2"><Label htmlFor="cnpj">CNPJ</Label><Input id="cnpj" inputMode="numeric" placeholder="Somente números" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: digits(e.target.value) })} required /></div>
        <div className="space-y-2 sm:col-span-2"><Label htmlFor="email">E-mail do administrador</Label><Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
        <Button type="submit" className="sm:col-span-2" disabled={!valid}>Continuar para pagamento</Button>
      </form>}
    </DialogContent></Dialog>
  </div>;
}