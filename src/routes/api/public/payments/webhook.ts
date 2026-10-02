import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

function periodIso(item: any, subscription: any, field: "current_period_start" | "current_period_end") {
  const seconds = item?.[field] ?? subscription?.[field];
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

function priceKey(item: any) {
  return item?.price?.lookup_key ?? item?.price?.metadata?.lovable_external_id ?? item?.price?.id ?? "unknown";
}

async function upsertSubscription(subscription: any, env: StripeEnv) {
  const metadata = subscription.metadata ?? {};
  const item = subscription.items?.data?.[0];
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (!customerId) throw new Error("Cliente da assinatura não encontrado");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let { data: company } = await supabaseAdmin
    .from("companies")
    .select("id,billing_email")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  if (!company) {
    const customer = typeof subscription.customer === "object" ? subscription.customer : null;
    const email = metadata.adminEmail ?? customer?.email;
    if (!email) throw new Error("E-mail do administrador não encontrado");
    const { provisionCompany } = await import("@/lib/provisioning.server");
    const provisioned = await provisionCompany({
      companyName: metadata.companyName ?? "Minha Empresa",
      adminName: metadata.adminName ?? "Administrador",
      adminEmail: email,
      cnpj: metadata.cnpj ?? null,
      plan: metadata.plan ?? priceKey(item),
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      billingInterval: metadata.billingInterval ?? item?.price?.recurring?.interval ?? null,
      currentPeriodEnd: periodIso(item, subscription, "current_period_end"),
      origin: "stripe",
    });
    company = { id: provisioned.company_id, billing_email: email };
  }

  const status = subscription.status ?? "active";
  const periodEnd = periodIso(item, subscription, "current_period_end");
  const planKey = metadata.plan ?? priceKey(item).split("_")[0];
  const maxEmployees = planKey === "enterprise" ? 1000 : planKey === "pro" ? 50 : 10;
  const remainsActive = ["active", "trialing", "past_due"].includes(status)
    || (status === "canceled" && periodEnd !== null && new Date(periodEnd).getTime() > Date.now());

  await supabaseAdmin.from("companies").update({
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    subscription_status: status,
    active: remainsActive,
    plan: planKey,
    max_employees: maxEmployees,
    billing_interval: metadata.billingInterval ?? item?.price?.recurring?.interval ?? null,
    current_period_end: periodEnd,
  }).eq("id", company.id);

  await supabaseAdmin.from("subscriptions").upsert({
    company_id: company.id,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: customerId,
    product_id: typeof item?.price?.product === "string" ? item.price.product : item?.price?.product?.id ?? "unknown",
    price_id: priceKey(item),
    status,
    current_period_start: periodIso(item, subscription, "current_period_start"),
    current_period_end: periodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    environment: env,
  }, { onConflict: "stripe_subscription_id,environment" });
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: { handlers: { POST: async ({ request }) => {
    const rawEnv = new URL(request.url).searchParams.get("env");
    if (rawEnv !== "sandbox" && rawEnv !== "live") return new Response("Ambiente inválido", { status: 400 });
    try {
      const event = await verifyWebhook(request, rawEnv);
      const object = event.data.object;
      if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
        await upsertSubscription(object, rawEnv);
      } else if (event.type === "subscription.created" || event.type === "subscription.updated" || event.type === "subscription.canceled") {
        await upsertSubscription(object, rawEnv);
      }
      return Response.json({ received: true });
    } catch (error) {
      console.error("Erro ao processar pagamento:", error);
      return new Response("Evento inválido", { status: 400 });
    }
  } } },
});