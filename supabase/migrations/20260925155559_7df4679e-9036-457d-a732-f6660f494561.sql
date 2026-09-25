
-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'employee');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  employee_code TEXT,
  department TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
$$;

CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "profiles_insert_admin" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "profiles_delete_admin" ON public.profiles FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- WORK SCHEDULES
CREATE TABLE public.work_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  is_working BOOLEAN NOT NULL DEFAULT true,
  work_start TIME,
  lunch_start TIME,
  lunch_end TIME,
  work_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, weekday)
);
CREATE INDEX idx_work_schedules_user ON public.work_schedules(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_schedules TO authenticated;
GRANT ALL ON public.work_schedules TO service_role;
ALTER TABLE public.work_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedules_select" ON public.work_schedules FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "schedules_write_admin" ON public.work_schedules FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- MONTHLY CLOSINGS
CREATE TABLE public.monthly_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year SMALLINT NOT NULL,
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE (year, month)
);
GRANT SELECT ON public.monthly_closings TO authenticated;
GRANT ALL ON public.monthly_closings TO service_role;
ALTER TABLE public.monthly_closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "closings_select" ON public.monthly_closings FOR SELECT TO authenticated USING (true);
CREATE POLICY "closings_write_admin" ON public.monthly_closings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- TIME RECORDS
CREATE TABLE public.time_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  lunch_start TIMESTAMPTZ,
  lunch_end TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, work_date)
);
CREATE INDEX idx_time_records_user_date ON public.time_records(user_id, work_date);
CREATE INDEX idx_time_records_date ON public.time_records(work_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_records TO authenticated;
GRANT ALL ON public.time_records TO service_role;
ALTER TABLE public.time_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "records_select" ON public.time_records FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "records_insert_own" ON public.time_records FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "records_update_own" ON public.time_records FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "records_delete_admin" ON public.time_records FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.block_closed_month()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d DATE;
BEGIN
  d := COALESCE(NEW.work_date, OLD.work_date);
  IF public.is_admin() THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM public.monthly_closings
    WHERE year = EXTRACT(YEAR FROM d)::SMALLINT AND month = EXTRACT(MONTH FROM d)::SMALLINT
  ) THEN
    RAISE EXCEPTION 'Mês fechado: registros não podem ser alterados.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_time_records_closed
BEFORE INSERT OR UPDATE OR DELETE ON public.time_records
FOR EACH ROW EXECUTE FUNCTION public.block_closed_month();

-- HOLIDAYS
CREATE TABLE public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE NOT NULL UNIQUE,
  description TEXT NOT NULL,
  holiday_type TEXT NOT NULL DEFAULT 'nacional',
  overtime_percent SMALLINT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holidays TO authenticated;
GRANT ALL ON public.holidays TO service_role;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "holidays_select" ON public.holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "holidays_write_admin" ON public.holidays FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- TIME ADJUSTMENTS
CREATE TABLE public.time_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_record_id UUID REFERENCES public.time_records(id) ON DELETE SET NULL,
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  field_name TEXT NOT NULL,
  old_value TIMESTAMPTZ,
  new_value TIMESTAMPTZ,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_adjustments_employee ON public.time_adjustments(employee_id, work_date);
GRANT SELECT, INSERT ON public.time_adjustments TO authenticated;
GRANT ALL ON public.time_adjustments TO service_role;
ALTER TABLE public.time_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adjustments_select" ON public.time_adjustments FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.is_admin());
CREATE POLICY "adjustments_insert_admin" ON public.time_adjustments FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND admin_id = auth.uid());

-- AUDIT LOGS
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created ON public.audit_logs(created_at DESC);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select_admin" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY "audit_insert_auth" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- SETTINGS
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_select" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_write_admin" ON public.app_settings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.app_settings (key, value) VALUES
  ('company', '{"name":"Minha Empresa","overtime_50":50,"overtime_100":100,"tolerance_minutes":0}'::jsonb);

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_records_updated BEFORE UPDATE ON public.time_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sched_updated BEFORE UPDATE ON public.work_schedules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Feriados nacionais 2026
INSERT INTO public.holidays (holiday_date, description, holiday_type, overtime_percent) VALUES
  ('2026-01-01','Confraternização Universal','nacional',100),
  ('2026-02-17','Carnaval','nacional',100),
  ('2026-04-03','Sexta-feira Santa','nacional',100),
  ('2026-04-21','Tiradentes','nacional',100),
  ('2026-05-01','Dia do Trabalho','nacional',100),
  ('2026-06-04','Corpus Christi','nacional',100),
  ('2026-09-07','Independência do Brasil','nacional',100),
  ('2026-10-12','Nossa Senhora Aparecida','nacional',100),
  ('2026-11-02','Finados','nacional',100),
  ('2026-11-15','Proclamação da República','nacional',100),
  ('2026-11-20','Consciência Negra','nacional',100),
  ('2026-12-25','Natal','nacional',100)
ON CONFLICT (holiday_date) DO NOTHING;
