CREATE TABLE public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY platform_admins_self ON public.platform_admins FOR SELECT TO authenticated USING (user_id = auth.uid());
INSERT INTO public.platform_admins (user_id) VALUES ('f9a2e167-b081-4c34-a0d4-c6ca9a2bcaea');