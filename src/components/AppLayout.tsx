import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  AlarmClock,
  CalendarDays,
  ClipboardList,
  FileBarChart,
  Users,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  ScrollText,
  Settings,
  Timer,
} from "lucide-react";
import { CreditCard } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { isPlatformAdmin } from "@/lib/platform.functions";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/SiteFooter";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const IDLE_LIMIT_MS = 10 * 60 * 1000;
const WARN_BEFORE_MS = 60 * 1000;

type NavItem = { to: string; label: string; icon: typeof Timer; adminOnly?: boolean };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/ponto", label: "Bater ponto", icon: Timer },
  { to: "/meus-registros", label: "Meus registros", icon: ClipboardList },
  { to: "/funcionarios", label: "Funcionários", icon: Users, adminOnly: true },
  { to: "/registros", label: "Registros de ponto", icon: AlarmClock, adminOnly: true },
  { to: "/feriados", label: "Feriados", icon: CalendarDays, adminOnly: true },
  { to: "/relatorios", label: "Relatórios", icon: FileBarChart, adminOnly: true },
  { to: "/fechamento", label: "Fechamento mensal", icon: Lock, adminOnly: true },
  { to: "/auditoria", label: "Log de auditoria", icon: ScrollText, adminOnly: true },
  { to: "/configuracoes", label: "Configurações", icon: Settings, adminOnly: true },
];

function Brand() {
  const { company } = useAuth();
  return (
    <div className="flex items-center gap-2.5 px-5 py-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow">
        <Timer className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-extrabold tracking-tight">ID Point</p>
        <p className="max-w-[10rem] truncate text-[11px] text-muted-foreground">
          {company?.name ?? "Controle de jornada"}
        </p>
      </div>
    </div>
  );
}

function NavLinks({ isAdmin, onNavigate }: { isAdmin: boolean; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const checkOwner = useServerFn(isPlatformAdmin);
  const owner = useQuery({ queryKey: ["platform-admin"], queryFn: () => checkOwner() });
  const items = [
    ...NAV.filter((i) => isAdmin || !i.adminOnly),
    ...(owner.data?.ok ? [{ to: "/assinaturas", label: "Assinaturas", icon: CreditCard }] : []),
  ];

  return (
    <nav className="flex flex-col gap-1 px-3">
      {items.map((item) => {
        const active = pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            )}
          >
            <item.icon
              className={cn("h-4.5 w-4.5 shrink-0", active ? "text-primary" : "opacity-80")}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, company, isAdmin, signOut, session } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [warning, setWarning] = useState(false);
  const lastActivity = useRef(Date.now());

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  // Logout automático após 10 minutos de inatividade.
  useEffect(() => {
    if (!session) return;
    const touch = () => {
      lastActivity.current = Date.now();
      setWarning(false);
    };
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));

    const interval = window.setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= IDLE_LIMIT_MS) {
        void handleSignOut();
      } else if (idle >= IDLE_LIMIT_MS - WARN_BEFORE_MS) {
        setWarning(true);
      }
    }, 5000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const initials = (profile?.full_name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  if (company && !company.active) {
    return (
      <div className="surface-gradient flex min-h-screen flex-col bg-background text-center">
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="max-w-md space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-extrabold">Acesso suspenso</h1>
          <p className="text-sm text-muted-foreground">
            A assinatura da {company.name} está inativa. Regularize o pagamento para liberar o
            acesso de toda a equipe. Se já pagou, aguarde alguns minutos ou fale com o suporte.
          </p>
          <Button onClick={handleSignOut}>Sair</Button>
          </div>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <Brand />
        <div className="flex-1 overflow-y-auto pb-4">
          <NavLinks isAdmin={isAdmin} />
        </div>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{profile?.full_name ?? "Usuário"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {isAdmin ? "Administrador" : "Funcionário"}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <Brand />
            <NavLinks isAdmin={isAdmin} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="text-sm font-bold">ID Point</span>
        <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sair">
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      <main className="surface-gradient flex min-h-screen flex-col lg:pl-64">
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        <SiteFooter />
      </main>

      <AlertDialog open={warning} onOpenChange={setWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sua sessão vai expirar</AlertDialogTitle>
            <AlertDialogDescription>
              Por segurança, você será desconectado em menos de 1 minuto por inatividade.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                lastActivity.current = Date.now();
                setWarning(false);
              }}
            >
              Continuar conectado
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
