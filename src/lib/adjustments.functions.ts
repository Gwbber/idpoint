import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getResponsibleAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: employee, error } = await context.supabase
      .from("profiles")
      .select("company_id, manager_admin_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw error;
    if (!employee?.manager_admin_id) return null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: admin } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, active, company_id")
      .eq("id", employee.manager_admin_id)
      .eq("company_id", employee.company_id)
      .maybeSingle();

    if (!admin?.active) return null;
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", admin.id)
      .eq("role", "admin")
      .maybeSingle();
    return role ? { id: admin.id, full_name: admin.full_name } : null;
  });