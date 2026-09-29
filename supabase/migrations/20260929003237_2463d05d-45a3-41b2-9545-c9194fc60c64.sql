ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'start',
  ADD COLUMN IF NOT EXISTS max_employees INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS billing_email TEXT,
  ADD COLUMN IF NOT EXISTS cakto_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS cakto_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS cakto_offer_id TEXT,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS custom_features JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS companies_cakto_subscription_key
  ON public.companies (cakto_subscription_id) WHERE cakto_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS companies_billing_email_idx ON public.companies (lower(billing_email));

CREATE TABLE IF NOT EXISTS public.cakto_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.cakto_events TO service_role;
ALTER TABLE public.cakto_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cakto_events_service_only" ON public.cakto_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.company_is_active(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT active FROM public.companies WHERE id = _company_id), false)
$$;

GRANT EXECUTE ON FUNCTION public.company_is_active(uuid) TO authenticated, service_role;