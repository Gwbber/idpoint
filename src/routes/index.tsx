import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Index,
  head: () => ({
    meta: [
      { title: "Ponto Certo — Controle de ponto eletrônico" },
      {
        name: "description",
        content:
          "Registre entrada, intervalo e saída, acompanhe horas extras e banco de horas em um só lugar.",
      },
      { property: "og:title", content: "Ponto Certo — Controle de ponto eletrônico" },
      {
        property: "og:description",
        content:
          "Registre entrada, intervalo e saída, acompanhe horas extras e banco de horas em um só lugar.",
      },
    ],
  }),
});

function Index() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    navigate({ to: session ? "/ponto" : "/auth", replace: true });
  }, [session, loading, navigate]);

  return (
    <div className="surface-gradient flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Clock className="h-5 w-5 animate-spin text-primary" />
        Carregando…
      </div>
    </div>
  );
}
