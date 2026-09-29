import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const scheduleSchema = z.object({
  weekday: z.number().min(0).max(6),
  is_working: z.boolean(),
  work_start: z.string().nullable(),
  lunch_start: z.string().nullable(),
  lunch_end: z.string().nullable(),
  work_end: z.string().nullable(),
});

const createSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
  full_name: z.string().trim().min(2).max(120),
  employee_code: z.string().trim().max(40).nullable(),
  department: z.string().trim().max(80).nullable(),
  is_admin: z.boolean(),
  schedules: z.array(scheduleSchema).max(7),
});

async function assertAdmin(supabase: {
  from: (t: string) => {
    select: (c: string) => {
      eq: (
        a: string,
        b: string,
      ) => {
        eq: (a: string, b: string) => { maybeSingle: () => Promise<{ data: unknown }> };
      };
    };
  };
}, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Acesso negado: apenas administradores.");
}

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: me } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", context.userId)
      .maybeSingle();
    const companyId = me?.company_id;
    if (!companyId) throw new Error("Empresa do administrador não encontrada.");

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("active, max_employees")
      .eq("id", companyId)
      .maybeSingle();
    if (!company?.active) {
      throw new Error("Assinatura inativa. Regularize o pagamento para cadastrar funcionários.");
    }
    const { count } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);
    if ((count ?? 0) >= (company.max_employees ?? 10)) {
      throw new Error(
        `Limite do plano atingido (${company.max_employees} usuários). Faça upgrade para cadastrar mais.`,
      );
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) {
      throw new Error(error?.message ?? "Não foi possível criar o funcionário.");
    }
    const newId = created.user.id;

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: newId,
      company_id: companyId,
      full_name: data.full_name,
      email: data.email,
      employee_code: data.employee_code,
      department: data.department,
      active: true,
    });
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(newId);
      throw new Error(profileError.message);
    }

    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newId, role: data.is_admin ? "admin" : "employee" });

    if (data.schedules.length > 0) {
      await supabaseAdmin
        .from("work_schedules")
        .insert(data.schedules.map((s) => ({ ...s, user_id: newId, company_id: companyId })));
    }

    return { id: newId };
  });


export const resetEmployeePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ user_id: z.string().uuid(), password: z.string().min(6).max(72) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ user_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    if (data.user_id === context.userId) throw new Error("Você não pode excluir seu próprio usuário.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setEmployeeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ user_id: z.string().uuid(), is_admin: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.is_admin ? "admin" : "employee" });
    return { ok: true };
  });

/** Cria o administrador inicial. Só funciona enquanto nenhum admin existir. */
export const bootstrapAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  if ((count ?? 0) > 0) {
    return { created: false, message: "Administrador já existe." };
  }

  const email = "admin@empresa.com.br";
  const password = "Admin@2026";

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Administrador" },
  });
  if (error || !created.user) {
    throw new Error(error?.message ?? "Falha ao criar administrador.");
  }

  await supabaseAdmin.from("profiles").insert({
    id: created.user.id,
    full_name: "Administrador",
    email,
    employee_code: "ADM001",
    department: "Administração",
    active: true,
  });
  await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });
  await supabaseAdmin.from("work_schedules").insert(
    [1, 2, 3, 4, 5].map((weekday) => ({
      user_id: created.user!.id,
      weekday,
      is_working: true,
      work_start: "08:00",
      lunch_start: "12:00",
      lunch_end: "13:00",
      work_end: "17:48",
    })),
  );

  return { created: true, email, password };
});
