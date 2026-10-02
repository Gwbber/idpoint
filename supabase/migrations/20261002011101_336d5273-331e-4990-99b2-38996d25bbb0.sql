ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS asaas_customer_id text, ADD COLUMN IF NOT EXISTS asaas_subscription_id text;
CREATE UNIQUE INDEX IF NOT EXISTS companies_asaas_subscription_uniq ON public.companies(asaas_subscription_id) WHERE asaas_subscription_id IS NOT NULL;
CREATE TABLE public.asaas_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.asaas_events TO service_role;
ALTER TABLE public.asaas_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY asaas_events_service_only ON public.asaas_events FOR ALL TO service_role USING (true) WITH CHECK (true);