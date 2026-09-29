import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Timer } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Entrar — Ponto Certo" },
      { name: "description", content: "Acesse o sistema de controle de ponto da empresa." },
      { property: "og:title", content: "Entrar — Ponto Certo" },
      {
        property: "og:description",
        content: "Acesse o sistema de controle de ponto da empresa.",
      },
    ],
  }),
});

const schema = z.object({
  email: z.string().trim().email({ message: "Informe um e-mail válido" }).max(255),
  password: z.string().min(6, { message: "A senha deve ter ao menos 6 caracteres" }).max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: "/ponto", replace: true });
  }, [session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      setLoading(false);
      toast.error("E-mail ou senha incorretos.");
      return;
    }
    const { data: company } = await supabase.from("companies").select("active").maybeSingle();
    setLoading(false);
    if (company && !company.active) {
      await supabase.auth.signOut();
      toast.error("Acesso suspenso: assinatura inativa. Regularize o pagamento para voltar a usar.");
      return;
    }
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/ponto", replace: true });
  };

  return (
    <div className="surface-gradient flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
            <Timer className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Ponto Certo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Controle de jornada, horas extras e banco de horas
          </p>
        </div>

        <Card className="border-border/70 shadow-card">
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>Use o e-mail e a senha fornecidos pela empresa.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={72}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Entrar
              </Button>
            </form>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Primeiro acesso ou esqueceu a senha?{" "}
              <Link to="/primeiro-acesso" className="font-semibold text-primary hover:underline">
                Defina sua senha
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
