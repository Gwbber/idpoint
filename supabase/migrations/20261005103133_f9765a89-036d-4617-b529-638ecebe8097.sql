CREATE UNIQUE INDEX idx_point_adjustment_requests_one_pending_per_day
ON public.point_adjustment_requests(company_id, employee_id, work_date)
WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.validate_point_adjustment_request()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.requested_clock_in IS NULL
    OR NEW.requested_lunch_start IS NULL
    OR NEW.requested_lunch_end IS NULL
    OR NEW.requested_clock_out IS NULL THEN
    RAISE EXCEPTION 'Informe os quatro horários do ajuste.';
  END IF;

  IF (NEW.requested_clock_in AT TIME ZONE 'America/Sao_Paulo')::date <> NEW.work_date
    OR (NEW.requested_lunch_start AT TIME ZONE 'America/Sao_Paulo')::date <> NEW.work_date
    OR (NEW.requested_lunch_end AT TIME ZONE 'America/Sao_Paulo')::date <> NEW.work_date
    OR (NEW.requested_clock_out AT TIME ZONE 'America/Sao_Paulo')::date <> NEW.work_date
    OR NOT (
      NEW.requested_clock_in < NEW.requested_lunch_start
      AND NEW.requested_lunch_start < NEW.requested_lunch_end
      AND NEW.requested_lunch_end < NEW.requested_clock_out
    ) THEN
    RAISE EXCEPTION 'Os horários devem pertencer à data escolhida e estar na ordem correta.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_point_adjustment_request
BEFORE INSERT ON public.point_adjustment_requests
FOR EACH ROW EXECUTE FUNCTION public.validate_point_adjustment_request();