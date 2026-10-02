ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS billing_interval text;

CREATE UNIQUE INDEX IF NOT EXISTS companies_stripe_subscription_uniq
  ON public.companies(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid,
  stripe_subscription_id text NOT NULL,
  stripe_customer_id text NOT NULL,
  product_id text NOT NULL,
  price_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'live')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stripe_subscription_id, environment)
);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_select_company
  ON public.subscriptions FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY subscriptions_service_manage
  ON public.subscriptions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX idx_subscriptions_company_environment
  ON public.subscriptions(company_id, environment, created_at DESC);
CREATE INDEX idx_subscriptions_stripe_customer
  ON public.subscriptions(stripe_customer_id);

CREATE TRIGGER trg_subscriptions_updated
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();