DROP POLICY point_adjustment_requests_update_admin ON public.point_adjustment_requests;
REVOKE UPDATE ON public.point_adjustment_requests FROM authenticated;

DROP FUNCTION public.complete_point_adjustment(uuid, timestamptz, timestamptz, timestamptz, timestamptz, text);
DROP FUNCTION public.reject_point_adjustment(uuid, text);

CREATE OR REPLACE FUNCTION public.complete_point_adjustment(
  _request_id uuid,
  _reviewer_id uuid,
  _clock_in timestamptz,
  _lunch_start timestamptz,
  _lunch_end timestamptz,
  _clock_out timestamptz,
  _review_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.point_adjustment_requests%ROWTYPE;
  rec public.time_records%ROWTYPE;
  record_id uuid;
  field_item record;
BEGIN
  SELECT * INTO req FROM public.point_adjustment_requests WHERE id = _request_id FOR UPDATE;
  IF req.id IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF req.assigned_admin_id <> _reviewer_id OR NOT public.has_role(_reviewer_id, 'admin') THEN
    RAISE EXCEPTION 'Somente o administrador responsável pode concluir esta solicitação.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _reviewer_id AND p.company_id = req.company_id AND p.active) THEN
    RAISE EXCEPTION 'Administrador responsável inválido.';
  END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'Esta solicitação já foi analisada.'; END IF;
  IF EXISTS (SELECT 1 FROM public.monthly_closings WHERE company_id = req.company_id AND year = EXTRACT(YEAR FROM req.work_date)::smallint AND month = EXTRACT(MONTH FROM req.work_date)::smallint) THEN
    RAISE EXCEPTION 'Mês fechado: o ajuste não pode ser concluído.';
  END IF;
  IF _clock_in IS NULL OR _clock_out IS NULL OR (_lunch_start IS NULL) <> (_lunch_end IS NULL)
    OR (_lunch_start IS NOT NULL AND NOT (_clock_in <= _lunch_start AND _lunch_start <= _lunch_end AND _lunch_end <= _clock_out))
    OR (_lunch_start IS NULL AND _clock_in > _clock_out) THEN
    RAISE EXCEPTION 'Os horários informados são inválidos ou estão fora de ordem.';
  END IF;

  SELECT * INTO rec FROM public.time_records WHERE company_id = req.company_id AND user_id = req.employee_id AND work_date = req.work_date FOR UPDATE;
  IF rec.id IS NULL THEN
    INSERT INTO public.time_records (company_id, user_id, work_date, clock_in, lunch_start, lunch_end, clock_out, notes)
    VALUES (req.company_id, req.employee_id, req.work_date, _clock_in, _lunch_start, _lunch_end, _clock_out, 'Criado por solicitação de ajuste aprovada')
    RETURNING id INTO record_id;
  ELSE
    record_id := rec.id;
    FOR field_item IN SELECT * FROM (VALUES
      ('clock_in', rec.clock_in, _clock_in), ('lunch_start', rec.lunch_start, _lunch_start),
      ('lunch_end', rec.lunch_end, _lunch_end), ('clock_out', rec.clock_out, _clock_out)
    ) AS values_table(field_name, old_value, new_value)
    LOOP
      IF field_item.old_value IS DISTINCT FROM field_item.new_value THEN
        INSERT INTO public.time_adjustments (company_id, time_record_id, employee_id, admin_id, work_date, field_name, old_value, new_value, reason)
        VALUES (req.company_id, record_id, req.employee_id, _reviewer_id, req.work_date, field_item.field_name, field_item.old_value, field_item.new_value, 'Solicitação de ajuste aprovada');
      END IF;
    END LOOP;
    UPDATE public.time_records SET clock_in = _clock_in, lunch_start = _lunch_start, lunch_end = _lunch_end, clock_out = _clock_out,
      notes = CASE WHEN notes IS NULL OR notes = '' THEN 'Corrigido por solicitação de ajuste aprovada' ELSE notes || E'\nCorrigido por solicitação de ajuste aprovada' END
    WHERE id = record_id;
  END IF;

  UPDATE public.point_adjustment_requests SET status = 'approved', review_notes = NULLIF(trim(_review_notes), ''), reviewed_by = _reviewer_id,
    reviewed_at = now(), requested_clock_in = _clock_in, requested_lunch_start = _lunch_start, requested_lunch_end = _lunch_end, requested_clock_out = _clock_out
  WHERE id = req.id;
  RETURN record_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_point_adjustment(uuid, uuid, timestamptz, timestamptz, timestamptz, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_point_adjustment(uuid, uuid, timestamptz, timestamptz, timestamptz, timestamptz, text) TO service_role;

CREATE OR REPLACE FUNCTION public.reject_point_adjustment(_request_id uuid, _reviewer_id uuid, _review_notes text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE req public.point_adjustment_requests%ROWTYPE;
BEGIN
  SELECT * INTO req FROM public.point_adjustment_requests WHERE id = _request_id FOR UPDATE;
  IF req.id IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF req.assigned_admin_id <> _reviewer_id OR NOT public.has_role(_reviewer_id, 'admin') THEN RAISE EXCEPTION 'Somente o administrador responsável pode recusar esta solicitação.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _reviewer_id AND p.company_id = req.company_id AND p.active) THEN RAISE EXCEPTION 'Administrador responsável inválido.'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'Esta solicitação já foi analisada.'; END IF;
  IF trim(COALESCE(_review_notes, '')) = '' THEN RAISE EXCEPTION 'Informe o motivo da recusa.'; END IF;
  UPDATE public.point_adjustment_requests SET status = 'rejected', review_notes = trim(_review_notes), reviewed_by = _reviewer_id, reviewed_at = now() WHERE id = req.id;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_point_adjustment(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_point_adjustment(uuid, uuid, text) TO service_role;