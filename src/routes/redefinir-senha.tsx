import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Timer } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/redefinir-senha")({
  ssr: false,
  component: RedefinirSenha,
  head: () => ({
    meta: [
      { title: "Criar nova senha — ID Point" },
      { name: "description", content: "Escolha uma nova senha para acessar o controle de ponto." },
      { property: "og:title", content: "Criar nova senha — ID Point" },
      {
        property: "og:description",
        content: "Escolha uma nova senha para acessar o controle de ponto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function RedefinirSenha() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setReady(Boolean(session)),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não conferem.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível salvar. Use uma senha mais forte e tente de novo.");
      return;
    }
    toast.success("Senha criada! Bem-vindo ao ID Point.");
    navigate({ to: "/ponto", replace: true });
  };

  return (
    <div className="surface-gradient flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
            <Timer className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">ID Point</h1>
        </div>

        <Card className="border-border/70 shadow-card">
          <CardHeader>
            <CardTitle>Criar nova senha</CardTitle>
            <CardDescription>
              {ready
                ? "Escolha uma senha com pelo menos 8 caracteres."
                : "Abra esta página pelo link enviado ao seu e-mail para criar a senha."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pwd">Nova senha</Label>
                <Input
                  id="pwd"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={72}
                  required
                  disabled={!ready}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pwd2">Confirmar senha</Label>
                <Input
                  id="pwd2"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  maxLength={72}
                  required
                  disabled={!ready}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !ready}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar senha
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
