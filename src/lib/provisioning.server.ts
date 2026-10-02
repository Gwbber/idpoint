import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Endereço público do sistema, usado nos links enviados por e-mail. */
const APP_URL = "https://idpoint.lovable.app";

export const HOLIDAYS_2026 = [
  { holiday_date: "2026-01-01", description: "Confraternização Universal" },
  { holiday_date: "2026-02-17", description: "Carnaval" },
  { holiday_date: "2026-04-03", description: "Sexta-feira Santa" },
  { holiday_date: "2026-04-21", description: "Tiradentes" },
  { holiday_date: "2026-05-01", description: "Dia do Trabalho" },
  { holiday_date: "2026-06-04", description: "Corpus Christi" },
  { holiday_date: "2026-09-07", description: "Independência do Brasil" },
  { holiday_date: "2026-10-12", description: "Nossa Senhora Aparecida" },
  { holiday_date: "2026-11-02", description: "Finados" },
  { holiday_date: "2026-11-15", description: "Proclamação da República" },
  { holiday_date: "2026-11-20", description: "Consciência Negra" },
  { holiday_date: "2026-12-25", description: "Natal" },
] as const;

export type PlanKey = "start" | "pro" | "enterprise";

export const PLANS: Record<PlanKey, { label: string; max_employees: number }> = {
  start: { label: "Start", max_employees: 10 },
  pro: { label: "Pro", max_employees: 50 },
  enterprise: { label: "Enterprise", max_employees: 1000 },
};

export function resolvePlan(raw?: string | null): PlanKey {
  const v = (raw ?? "").toLowerCase();
  if (v.includes("enterprise") || v.includes("ilimit")) return "enterprise";
  if (v.includes("pro") || v.includes("50") || v.includes("149")) return "pro";
  return "start";
}

function randomPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return `Pt!${Array.from(bytes, (b) => b.toString(36)).join("")}A9`.slice(0, 32);
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  return data?.id ?? null;
}

export type ProvisionInput = {
  companyName: string;
  adminName: string;
  adminEmail: string;
  cnpj?: string | null;
  plan?: string | null;
  caktoCustomerId?: string | null;
  caktoSubscriptionId?: string | null;
  caktoOfferId?: string | null;
  currentPeriodEnd?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  billingInterval?: string | null;
  origin?: string;
};

export type ProvisionResult = {
  company_id: string;
  admin_user_id: string;
  created: boolean;
  recovery_link: string | null;
};

/** Cria (ou reativa) a empresa cliente com seu primeiro administrador. */
export async function provisionCompany(input: ProvisionInput): Promise<ProvisionResult> {
  const email = input.adminEmail.trim().toLowerCase();
  const planKey = resolvePlan(input.plan);
  const plan = PLANS[planKey];

  // Já existe empresa para essa assinatura ou e-mail de cobrança? Reativa.
  let existing: { id: string } | null = null;
  if (input.caktoSubscriptionId) {
    const { data } = await supabaseAdmin
      .from("companies")
      .select("id")
      .eq("cakto_subscription_id", input.caktoSubscriptionId)
      .maybeSingle();
    existing = data ?? null;
  }
  if (!existing && input.stripeSubscriptionId) {
    const { data } = await supabaseAdmin
      .from("companies")
      .select("id")
      .eq("stripe_subscription_id", input.stripeSubscriptionId)
      .maybeSingle();
    existing = data ?? null;
  }
  if (!existing) {
    const { data } = await supabaseAdmin
      .from("companies")
      .select("id")
      .ilike("billing_email", email)
      .maybeSingle();
    existing = data ?? null;
  }

  if (existing) {
    await supabaseAdmin
      .from("companies")
      .update({
        active: true,
        subscription_status: "active",
        plan: planKey,
        max_employees: plan.max_employees,
        ...(input.caktoSubscriptionId
          ? {
              cakto_customer_id: input.caktoCustomerId ?? null,
              cakto_subscription_id: input.caktoSubscriptionId,
              cakto_offer_id: input.caktoOfferId ?? null,
            }
          : {}),
        ...(input.stripeSubscriptionId
          ? {
              stripe_customer_id: input.stripeCustomerId ?? null,
              stripe_subscription_id: input.stripeSubscriptionId,
              billing_interval: input.billingInterval ?? null,
            }
          : {}),
        current_period_end: input.currentPeriodEnd ?? null,
      })
      .eq("id", existing.id);
    const userId = (await findUserIdByEmail(email)) ?? "";
    return { company_id: existing.id, admin_user_id: userId, created: false, recovery_link: null };
  }

  const { data: company, error: companyError } = await supabaseAdmin
    .from("companies")
    .insert({
      name: input.companyName.trim() || "Minha Empresa",
      cnpj: input.cnpj ?? null,
      active: true,
      plan: planKey,
      max_employees: plan.max_employees,
      subscription_status: "active",
      billing_email: email,
      cakto_customer_id: input.caktoCustomerId ?? null,
      cakto_subscription_id: input.caktoSubscriptionId ?? null,
      cakto_offer_id: input.caktoOfferId ?? null,
      stripe_customer_id: input.stripeCustomerId ?? null,
      stripe_subscription_id: input.stripeSubscriptionId ?? null,
      billing_interval: input.billingInterval ?? null,
      current_period_end: input.currentPeriodEnd ?? null,
    })
    .select("id")
    .single();
  if (companyError || !company) {
    throw new Error(companyError?.message ?? "Falha ao criar a empresa.");
  }

  let adminId = await findUserIdByEmail(email);
  if (!adminId) {
    const { data: created, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: randomPassword(),
      email_confirm: true,
      user_metadata: { full_name: input.adminName },
    });
    if (userError || !created.user) {
      throw new Error(userError?.message ?? "Falha ao criar o administrador.");
    }
    adminId = created.user.id;
  }

  await supabaseAdmin.from("profiles").upsert({
    id: adminId,
    company_id: company.id,
    full_name: input.adminName.trim() || "Administrador",
    email,
    employee_code: "ADM001",
    department: "Administração",
    active: true,
  });
  await supabaseAdmin.from("user_roles").delete().eq("user_id", adminId);
  await supabaseAdmin.from("user_roles").insert({ user_id: adminId, role: "admin" });

  await supabaseAdmin.from("work_schedules").insert(
    [1, 2, 3, 4, 5].map((weekday) => ({
      user_id: adminId!,
      company_id: company.id,
      weekday,
      is_working: true,
      work_start: "08:00",
      lunch_start: "12:00",
      lunch_end: "13:00",
      work_end: "17:48",
    })),
  );

  await supabaseAdmin.from("app_settings").upsert({
    company_id: company.id,
    key: "company",
    value: {
      name: input.companyName.trim() || "Minha Empresa",
      overtime_50: 50,
      overtime_100: 100,
      tolerance_minutes: 10,
    },
  });

  await supabaseAdmin.from("holidays").insert(
    HOLIDAYS_2026.map((h) => ({
      company_id: company.id,
      holiday_date: h.holiday_date,
      description: h.description,
      holiday_type: "nacional",
      overtime_percent: 100,
    })),
  );

  await supabaseAdmin.from("audit_logs").insert({
    company_id: company.id,
    actor_id: adminId,
    actor_name: input.adminName,
    action: "company_registered",
    entity: "company",
    entity_id: company.id,
    details: { plan: planKey, origem: input.origin ?? "cakto" },
  });

  let recoveryLink: string | null = null;
  const { data: link } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${APP_URL}/redefinir-senha` },
  });
  recoveryLink = link?.properties?.action_link ?? null;

  return { company_id: company.id, admin_user_id: adminId, created: true, recovery_link: recoveryLink };
}

/** Bloqueia o acesso da empresa (cancelamento, reembolso ou inadimplência). */
export async function suspendCompanyBySubscription(params: {
  subscriptionId?: string | null;
  stripeSubscriptionId?: string | null;
  email?: string | null;
  status: string;
}): Promise<string | null> {
  let query = supabaseAdmin.from("companies").select("id");
  if (params.stripeSubscriptionId) {
    query = query.eq("stripe_subscription_id", params.stripeSubscriptionId);
  } else if (params.subscriptionId) {
    query = query.eq("cakto_subscription_id", params.subscriptionId);
  } else if (params.email) {
    query = query.ilike("billing_email", params.email.trim().toLowerCase());
  } else {
    return null;
  }
  const { data } = await query.maybeSingle();
  if (!data) return null;
  await supabaseAdmin
    .from("companies")
    .update({ active: false, subscription_status: params.status })
    .eq("id", data.id);
  return data.id;
}
