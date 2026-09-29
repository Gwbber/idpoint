import { createFileRoute } from "@tanstack/react-router";

type AnyRecord = Record<string, unknown>;

const APPROVED = new Set([
  "purchase_approved",
  "purchase_aproved",
  "payment_approved",
  "subscription_created",
  "subscription_renewed",
  "subscription_reactivated",
  "pix_approved",
  "compra_aprovada",
]);

const CANCELLED = new Set([
  "subscription_canceled",
  "subscription_cancelled",
  "purchase_refunded",
  "refund",
  "refunded",
  "chargeback",
  "purchase_chargeback",
  "subscription_expired",
  "purchase_canceled",
  "purchase_cancelled",
  "assinatura_cancelada",
]);

function pick(obj: AnyRecord | undefined, ...keys: string[]): string | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

export const Route = createFileRoute("/api/public/cakto-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["CAKTO_WEBHOOK_TOKEN"];
        if (!expected) {
          return new Response("Webhook não configurado", { status: 500 });
        }

        let body: AnyRecord;
        try {
          body = (await request.json()) as AnyRecord;
        } catch {
          return new Response("JSON inválido", { status: 400 });
        }

        const headerToken =
          request.headers.get("x-cakto-signature") ??
          request.headers.get("x-webhook-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          null;
        const bodyToken = pick(body, "secret", "token", "webhook_secret");
        if (headerToken !== expected && bodyToken !== expected) {
          return new Response("Token inválido", { status: 401 });
        }

        const eventType = (
          pick(body, "event", "event_type", "type", "status") ?? ""
        ).toLowerCase();
        const data = (body["data"] as AnyRecord | undefined) ?? body;
        const customer = (data["customer"] as AnyRecord | undefined) ?? {};
        const offer = (data["offer"] as AnyRecord | undefined) ?? {};
        const product = (data["product"] as AnyRecord | undefined) ?? {};
        const subscription = (data["subscription"] as AnyRecord | undefined) ?? {};

        const email = pick(customer, "email") ?? pick(data, "email", "customer_email");
        const name = pick(customer, "name", "fullName") ?? "Administrador";
        const companyName =
          pick(customer, "company", "companyName") ?? `Empresa de ${name.split(" ")[0]}`;
        const docNumber = pick(customer, "docNumber", "document", "cnpj");
        const subscriptionId =
          pick(subscription, "id") ?? pick(data, "subscription_id", "subscriptionId");
        const eventId =
          pick(body, "id", "event_id") ??
          `${eventType}:${pick(data, "id", "transaction_id") ?? email ?? crypto.randomUUID()}`;
        const planSource =
          pick(offer, "name", "id") ?? pick(product, "name") ?? pick(data, "plan");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotência: ignora reenvios do mesmo evento.
        const { data: seen } = await supabaseAdmin
          .from("cakto_events")
          .select("id")
          .eq("event_id", eventId)
          .maybeSingle();
        if (seen) return Response.json({ ok: true, duplicated: true });

        let companyId: string | null = null;
        let result: AnyRecord = { handled: false };

        try {
          if (APPROVED.has(eventType)) {
            if (!email) return new Response("E-mail do comprador ausente", { status: 400 });
            const { provisionCompany } = await import("@/lib/provisioning.server");
            const provisioned = await provisionCompany({
              companyName,
              adminName: name,
              adminEmail: email,
              cnpj: docNumber && docNumber.replace(/\D/g, "").length === 14 ? docNumber : null,
              plan: planSource,
              caktoCustomerId: pick(customer, "id"),
              caktoSubscriptionId: subscriptionId,
              caktoOfferId: pick(offer, "id"),
              currentPeriodEnd:
                pick(subscription, "next_charge_date", "nextChargeDate", "current_period_end") ??
                null,
            });
            companyId = provisioned.company_id;
            result = { handled: true, created: provisioned.created };
          } else if (CANCELLED.has(eventType)) {
            const { suspendCompanyBySubscription } = await import("@/lib/provisioning.server");
            companyId = await suspendCompanyBySubscription({
              subscriptionId,
              email,
              status: eventType,
            });
            result = { handled: true, suspended: Boolean(companyId) };
          }

          await supabaseAdmin.from("cakto_events").insert({
            event_id: eventId,
            event_type: eventType || "desconhecido",
            company_id: companyId,
            payload: body as never,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Erro ao processar";
          await supabaseAdmin.from("cakto_events").insert({
            event_id: `${eventId}:erro:${Date.now()}`,
            event_type: `${eventType || "desconhecido"}_erro`,
            payload: { erro: message, original: body } as never,
          });
          return new Response(message, { status: 500 });
        }

        return Response.json({ ok: true, ...result });
      },
    },
  },
});
