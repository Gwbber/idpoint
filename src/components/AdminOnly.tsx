import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!isAdmin)
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border p-10 text-center">
        <ShieldAlert className="h-8 w-8 text-destructive" />
        <p className="font-semibold">Acesso restrito a administradores.</p>
      </div>
    );
  return <>{children}</>;
}
