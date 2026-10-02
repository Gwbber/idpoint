import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, MailCheck, Timer } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/primeiro-acesso")({
  ssr: false,
  component: PrimeiroAcesso,
  head: () => ({
    meta: [
      { title: "Primeiro acesso — ID Point" },
      {
        name: "description",
        content: "Defina a senha da sua conta para começar a usar o controle de ponto.",
      },
      { property: "og:title", content: "Primeiro acesso — ID Point" },
      {
        property: "og:description",
        content: "Defina a senha da sua conta para começar a usar o controle de ponto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function PrimeiroAcesso() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = z.string().trim().email().max(255).safeParse(email);
    if (!parsed.success) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.toLowerCase(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível enviar agora. Tente novamente em instantes.");
      return;
    }
    setSent(true);
  };

  return (
    <div className="surface-gradient flex min-h-screen flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
            <Timer className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">ID Point</h1>
          <p className="mt-1 text-sm text-muted-foreground">Defina a senha do seu acesso</p>
        </div>

        <Card className="border-border/70 shadow-card">
          <CardHeader>
            <CardTitle>Primeiro acesso</CardTitle>
            <CardDescription>
              Informe o e-mail usado na compra (ou o cadastrado pela sua empresa). Enviaremos um
              link para você criar a sua senha.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-4 text-center">
                <MailCheck className="mx-auto h-10 w-10 text-primary" />
                <p className="text-sm text-muted-foreground">
                  Enviamos um link para <strong>{email}</strong>. Abra o e-mail e escolha sua senha.
                  Se não encontrar, confira a caixa de spam.
                </p>
                <Button asChild variant="secondary" className="w-full">
                  <Link to="/auth">Voltar para o login</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="voce@empresa.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={255}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enviar link
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  <Link to="/auth" className="font-semibold text-primary hover:underline">
                    Já tenho senha, quero entrar
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
