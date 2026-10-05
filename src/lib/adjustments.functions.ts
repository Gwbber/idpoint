import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const timesSchema = z.object({
  requestId: z.string().uuid(),
  clockIn: z.string().datetime(),
  lunchStart: z.string().datetime(),
  lunchEnd: z.string().datetime(),
  clockOut: z.string().datetime(),
  reviewNotes: z.string().trim().max(500),
});

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

export const completePointAdjustment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => timesSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso negado: apenas administradores.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: recordId, error } = await supabaseAdmin.rpc("complete_point_adjustment", {
      _request_id: data.requestId,
      _reviewer_id: context.userId,
      _clock_in: data.clockIn,
      _lunch_start: data.lunchStart,
      _lunch_end: data.lunchEnd,
      _clock_out: data.clockOut,
      _review_notes: data.reviewNotes,
    });
    if (error) throw new Error(error.message);
    return { recordId };
  });

export const rejectPointAdjustment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    requestId: z.string().uuid(),
    reviewNotes: z.string().trim().min(1).max(500),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso negado: apenas administradores.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("reject_point_adjustment", {
      _request_id: data.requestId,
      _reviewer_id: context.userId,
      _review_notes: data.reviewNotes,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });