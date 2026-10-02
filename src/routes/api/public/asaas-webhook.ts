import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

type AnyRecord = Record<string, unknown>;

const PAID = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);
const SUSPEND = new Set([
  "PAYMENT_OVERDUE",
  "PAYMENT_REFUNDED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "SUBSCRIPTION_INACTIVATED",
  "SUBSCRIPTION_DELETED",
]);

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function asaasBase(apiKey: string) {
  return apiKey.includes("_hmlg_") || apiKey.startsWith("$aact_hmlg")
    ? "https://api-sandbox.asaas.com/v3"
    : "https://api.asaas.com/v3";
}

async function asaasGet(path: string): Promise<AnyRecord | null> {
  const key = process.env["ASAAS_API_KEY"];
  if (!key) return null;
  const res = await fetch(`${asaasBase(key)}${path}`, {
    headers: { access_token: key, "User-Agent": "IDPoint" },
  });
  if (!res.ok) return null;
  return (await res.json()) as AnyRecord;
}

export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["ASAAS_WEBHOOK_TOKEN"];
        if (!expected) return new Response("Webhook não configurado", { status: 500 });
        const token = request.headers.get("asaas-access-token") ?? "";
        if (!safeEqual(token, expected)) return new Response("Token inválido", { status: 401 });

        let body: AnyRecord;
        try {
          body = (await request.json()) as AnyRecord;
        } catch {
          return new Response("JSON inválido", { status: 400 });
        }

        const eventType = str(body["event"]) ?? "";
        const payment = (body["payment"] as AnyRecord | undefined) ?? {};
        const subscriptionObj = (body["subscription"] as AnyRecord | undefined) ?? {};
        const subscriptionId = str(payment["subscription"]) ?? str(subscriptionObj["id"]);
        const customerId = str(payment["customer"]) ?? str(subscriptionObj["customer"]);
        const eventId =
          str(body["id"]) ?? `${eventType}:${str(payment["id"]) ?? str(subscriptionObj["id"]) ?? crypto.randomUUID()}`;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: seen } = await supabaseAdmin
          .from("asaas_events")
          .select("id")
          .eq("event_id", eventId)
          .maybeSingle();
        if (seen) return Response.json({ ok: true, duplicated: true });

        let companyId: string | null = null;
        let result: AnyRecord = { handled: false };

        try {
          if (PAID.has(eventType)) {
            const customer = customerId ? await asaasGet(`/customers/${customerId}`) : null;
            const subscription = subscriptionId
              ? await asaasGet(`/subscriptions/${subscriptionId}`)
              : null;
            const email = str(customer?.["email"]);
            if (!email) throw new Error("E-mail do cliente não encontrado no Asaas");
            const name = str(customer?.["name"]) ?? "Administrador";
            const company = str(customer?.["company"]) ?? name;
            const doc = (str(customer?.["cpfCnpj"]) ?? "").replace(/\D/g, "");
            const planSource =
              str(subscription?.["description"]) ??
              str(payment["description"]) ??
              String(payment["value"] ?? "");
            const nextDue = str(subscription?.["nextDueDate"]);

            const { provisionCompany } = await import("@/lib/provisioning.server");
            const provisioned = await provisionCompany({
              companyName: company,
              adminName: name,
              adminEmail: email,
              cnpj: doc.length === 14 ? doc : null,
              plan: planSource,
              asaasCustomerId: customerId,
              asaasSubscriptionId: subscriptionId,
              currentPeriodEnd: nextDue ? `${nextDue}T23:59:59-03:00` : null,
              origin: "asaas",
            });
            companyId = provisioned.company_id;
            result = { handled: true, created: provisioned.created };
          } else if (SUSPEND.has(eventType)) {
            const { suspendCompanyBySubscription } = await import("@/lib/provisioning.server");
            let email: string | null = null;
            if (!subscriptionId && customerId) {
              email = str((await asaasGet(`/customers/${customerId}`))?.["email"]);
            }
            companyId = await suspendCompanyBySubscription({
              asaasSubscriptionId: subscriptionId,
              email,
              status: eventType.toLowerCase(),
            });
            result = { handled: true, suspended: Boolean(companyId) };
          }

          await supabaseAdmin.from("asaas_events").insert({
            event_id: eventId,
            event_type: eventType || "desconhecido",
            company_id: companyId,
            payload: body as never,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Erro ao processar";
          await supabaseAdmin.from("asaas_events").insert({
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
