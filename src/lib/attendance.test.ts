import { describe, test } from "node:test";
import { strictEqual } from "node:assert";
import { summarizeDay, type TimeRecord } from "./attendance";

describe("horas extras dos feriados de novembro de 2026", () => {
  for (const { date, start, end, minutes } of [
    { date: "2026-11-02", start: "07:37", end: "14:51", minutes: 434 },
    { date: "2026-11-20", start: "06:40", end: "12:10", minutes: 330 },
  ]) {
    test(`${date}: todo o trabalho conta como extra a 100%`, () => {
      const record: TimeRecord = {
        id: date,
        user_id: "employee",
        work_date: date,
        clock_in: `${date}T${start}:00-03:00`,
        lunch_start: null,
        lunch_end: null,
        clock_out: `${date}T${end}:00-03:00`,
        notes: null,
      };
      const holiday = { id: date, holiday_date: date, description: "Feriado", holiday_type: "national", overtime_percent: 100 };
      const result = summarizeDay(date, record, new Map(), new Map([[date, holiday]]));
      strictEqual(result.workedMinutes, minutes);
      strictEqual(result.overtime100, minutes);
      strictEqual(result.overtime50, 0);
      strictEqual(result.regularMinutes, 0);
    });
  }
});