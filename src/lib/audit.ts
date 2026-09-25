import { supabase } from "@/integrations/supabase/client";

export async function logAudit(params: {
  actorId: string;
  actorName: string;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
}) {
  await supabase.from("audit_logs").insert({
    actor_id: params.actorId,
    actor_name: params.actorName,
    action: params.action,
    entity: params.entity,
    entity_id: params.entityId ?? null,
    details: (params.details ?? {}) as never,
  });
}
