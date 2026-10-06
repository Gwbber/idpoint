DO $$
DECLARE test_id uuid; original_role text := current_user;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '1cd893b2-8b65-4dea-b88f-19b95764ec4f', true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    INSERT INTO public.point_adjustment_requests(employee_id, assigned_admin_id, work_date, requested_clock_in, requested_lunch_start, requested_lunch_end, requested_clock_out)
    VALUES ('1cd893b2-8b65-4dea-b88f-19b95764ec4f', '9a63ff22-c8d3-4aa3-b521-52c6ed723189', '2026-10-02', '2026-10-02T07:30:00-03:00', '2026-10-02T12:05:00-03:00', '2026-10-02T13:05:00-03:00', '2026-10-02T18:21:00-03:00') RETURNING id INTO test_id;
    IF NOT EXISTS (SELECT 1 FROM public.point_adjustment_requests WHERE id=test_id) THEN RAISE EXCEPTION 'Own request read failed'; END IF;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id='9a63ff22-c8d3-4aa3-b521-52c6ed723189') THEN RAISE EXCEPTION 'Admin profile unexpectedly visible'; END IF;
    RAISE EXCEPTION 'discard_successful_test';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'discard_successful_test' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.point_adjustment_requests(employee_id, assigned_admin_id, work_date, requested_clock_in, requested_lunch_start, requested_lunch_end, requested_clock_out)
    VALUES ('1cd893b2-8b65-4dea-b88f-19b95764ec4f', 'f9a2e167-b081-4c34-a0d4-c6ca9a2bcaea', '2026-10-02', '2026-10-02T07:30:00-03:00', '2026-10-02T12:05:00-03:00', '2026-10-02T13:05:00-03:00', '2026-10-02T18:21:00-03:00');
    RAISE EXCEPTION 'Invalid administrator was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  EXECUTE format('SET LOCAL ROLE %I', original_role);
END;
$$;