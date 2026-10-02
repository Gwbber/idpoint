import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const isPlatformAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("platform_admins" as never)
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { ok: Boolean(data) };
  });

export const listSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: me } = await context.supabase
      .from("platform_admins" as never)
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!me) throw new Error("Acesso restrito ao dono da plataforma.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: companies, error }, { data: profiles }] = await Promise.all([
      supabaseAdmin
        .from("companies")
        .select("id,name,cnpj,plan,max_employees,active,subscription_status,billing_email,current_period_end,created_at,stripe_customer_id,stripe_subscription_id,billing_interval")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("profiles").select("company_id,active"),
    ]);
    if (error) throw new Error(error.message);
    const counts = new Map<string, number>();
    (profiles ?? []).forEach((p) => {
      if (p.active) counts.set(p.company_id, (counts.get(p.company_id) ?? 0) + 1);
    });
    return (companies ?? []).map((c) => ({ ...c, employees: counts.get(c.id) ?? 0 }));
  });
