import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/checkout/retorno")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({ session_id: typeof search.session_id === "string" ? search.session_id : undefined }),
  component: CheckoutReturn,
  head: () => ({ meta: [
    { title: "Assinatura recebida — ID Point" },
    { name: "description", content: "Confirmação da assinatura do ID Point." },
    { property: "og:title", content: "Assinatura recebida — ID Point" },
    { property: "og:description", content: "Confirmação da assinatura do ID Point." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

function CheckoutReturn() {
  const { session_id } = Route.useSearch();
  return <main className="surface-gradient flex min-h-screen items-center justify-center bg-background px-4"><div className="max-w-lg text-center">
    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-success/15 text-success">{session_id ? <CheckCircle2 className="h-8 w-8" /> : <Timer className="h-8 w-8" />}</span>
    <h1 className="mt-5 text-3xl font-extrabold">{session_id ? "Assinatura recebida" : "Aguardando confirmação"}</h1>
    <p className="mt-3 text-muted-foreground">Assim que o pagamento for confirmado, sua empresa será preparada automaticamente. Depois, use o e-mail da compra para definir sua senha.</p>
    <Button asChild className="mt-7"><Link to="/primeiro-acesso">Definir minha senha</Link></Button>
  </div></main>;
}