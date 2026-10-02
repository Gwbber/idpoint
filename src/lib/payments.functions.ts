import Stripe from "stripe";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";

const checkoutSchema = z.object({
  priceId: z.enum([
    "start_monthly", "start_yearly", "pro_monthly", "pro_yearly",
    "enterprise_monthly", "enterprise_yearly",
  ]),
  companyName: z.string().trim().min(2).max(120),
  adminName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255).transform((v) => v.toLowerCase()),
  cnpj: z.string().regex(/^\d{14}$/),
  returnUrl: z.string().url().max(500),
  environment: z.enum(["sandbox", "live"]),
});

async function resolveCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  email: string,
  metadata: Record<string, string>,
) {
  const existing = await stripe.customers.list({ email, limit: 1 });
  const customer = existing.data[0];
  if (customer) {
    await stripe.customers.update(customer.id, { metadata: { ...customer.metadata, ...metadata } });
    return customer.id;
  }
  return (await stripe.customers.create({ email, name: metadata.adminName, metadata })).id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((input) => checkoutSchema.parse(input))
  .handler(async ({ data }): Promise<{ clientSecret: string } | { error: string }> => {
    try {
      const stripe = createStripeClient(data.environment as StripeEnv);
      const prices = await stripe.prices.list({ lookup_keys: [data.priceId], active: true, limit: 1 });
      const price = prices.data[0];
      if (!price || price.type !== "recurring") throw new Error("Plano não encontrado");

      const plan = data.priceId.split("_")[0] ?? "start";
      const interval = data.priceId.endsWith("yearly") ? "year" : "month";
      const metadata = {
        companyName: data.companyName,
        adminName: data.adminName,
        adminEmail: data.email,
        cnpj: data.cnpj,
        plan,
        billingInterval: interval,
      };
      const customerId = await resolveCustomer(stripe, data.email, metadata);

      const active = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 });
      if (active.data.some((item) => ["active", "trialing", "past_due"].includes(item.status))) {
        throw new Error("Este e-mail já possui uma assinatura ativa. Entre em contato para trocar de plano.");
      }

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: price.id, quantity: 1 }],
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        automatic_tax: { enabled: true },
        metadata,
        subscription_data: { metadata },
      } as Stripe.Checkout.SessionCreateParams);
      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });