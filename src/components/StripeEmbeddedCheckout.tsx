import { useCallback } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { createCheckoutSession } from "@/lib/payments.functions";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";

type CheckoutData = {
  priceId: "start_monthly" | "start_yearly" | "pro_monthly" | "pro_yearly" | "enterprise_monthly" | "enterprise_yearly";
  companyName: string;
  adminName: string;
  email: string;
  cnpj: string;
};

export function StripeEmbeddedCheckout({ data }: { data: CheckoutData }) {
  const fetchClientSecret = useCallback(async () => {
    const result = await createCheckoutSession({
      data: {
        ...data,
        environment: getStripeEnvironment(),
        returnUrl: `${window.location.origin}/checkout/retorno?session_id={CHECKOUT_SESSION_ID}`,
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Não foi possível abrir o pagamento.");
    return result.clientSecret;
  }, [data]);

  return (
    <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
      <EmbeddedCheckout />
    </EmbeddedCheckoutProvider>
  );
}