import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Holiday, Profile, TimeRecord, WorkSchedule } from "@/lib/attendance";
import { monthRange, todayISO } from "@/lib/time-utils";

export function useHolidays() {
  return useQuery({
    queryKey: ["holidays"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holidays")
        .select("*")
        .order("holiday_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Holiday[];
    },
  });
}

export function useHolidayMap() {
  const query = useHolidays();
  const map = new Map<string, Holiday>();
  (query.data ?? []).forEach((h) => map.set(h.holiday_date, h));
  return { ...query, map };
}

export function useSchedules(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["schedules", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_schedules")
        .select("*")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []) as WorkSchedule[];
    },
  });
}

export function useAllSchedules() {
  return useQuery({
    queryKey: ["schedules", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("work_schedules").select("*");
      if (error) throw error;
      return (data ?? []) as WorkSchedule[];
    },
  });
}

export function useTodayRecord(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["record", userId, todayISO()],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_records")
        .select("*")
        .eq("user_id", userId!)
        .eq("work_date", todayISO())
        .maybeSingle();
      if (error) throw error;
      return (data as TimeRecord | null) ?? null;
    },
    refetchInterval: 60_000,
  });
}

export function useMonthRecords(
  userId: string | null | undefined,
  year: number,
  month: number,
  all = false,
) {
  const { start, end } = monthRange(year, month);
  return useQuery({
    queryKey: ["records", all ? "all" : userId, year, month],
    enabled: all || Boolean(userId),
    queryFn: async () => {
      let query = supabase
        .from("time_records")
        .select("*")
        .gte("work_date", start)
        .lte("work_date", end);
      if (!all) query = query.eq("user_id", userId!);
      const { data, error } = await query.order("work_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TimeRecord[];
    },
  });
}

export function useEmployees() {
  return useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });
}

export function useRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useClosings() {
  return useQuery({
    queryKey: ["closings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_closings")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("key", "company")
        .maybeSingle();
      if (error) throw error;
      return (data?.value ?? {}) as {
        name?: string;
        overtime_50?: number;
        overtime_100?: number;
        tolerance_minutes?: number;
      };
    },
  });
}
