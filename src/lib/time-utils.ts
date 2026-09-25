export const TZ = "America/Sao_Paulo";

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const timeFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const timeSecFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const longDateFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

/** ISO date (yyyy-mm-dd) do "hoje" no fuso de São Paulo. */
export function todayISO(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts;
}

export function isoToDisplay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "--/--/----";
  return dateFmt.format(typeof value === "string" ? new Date(value) : value);
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "--:--";
  return timeFmt.format(typeof value === "string" ? new Date(value) : value);
}

export function formatTimeWithSeconds(value: Date): string {
  return timeSecFmt.format(value);
}

export function formatLongDate(value: Date): string {
  const text = longDateFmt.format(value);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "-";
  return `${formatDate(value)} ${formatTime(value)}`;
}

/** Minutos -> "8h 48m" (com sinal quando pedido). */
export function formatMinutes(total: number, signed = false): string {
  const sign = total < 0 ? "-" : signed ? "+" : "";
  const abs = Math.abs(Math.round(total));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m}m`;
  return `${sign}${h}h ${String(m).padStart(2, "0")}m`;
}

/** Minutos -> "08:48" */
export function formatMinutesClock(total: number, signed = false): string {
  const sign = total < 0 ? "-" : signed ? "+" : "";
  const abs = Math.abs(Math.round(total));
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/** "08:00" -> 480 */
export function timeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const [h, m] = value.split(":");
  if (h === undefined || m === undefined) return null;
  return Number(h) * 60 + Number(m);
}

/** Dia da semana (0=domingo) da data ISO, no fuso local de São Paulo. */
export function weekdayOfISO(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

export const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** Todas as datas ISO de um mês. */
export function monthDays(year: number, month: number): string[] {
  const days: string[] = [];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let d = 1; d <= last; d++) {
    days.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return days;
}

export function monthRange(year: number, month: number): { start: string; end: string } {
  const days = monthDays(year, month);
  return { start: days[0]!, end: days[days.length - 1]! };
}

/**
 * Converte "HH:MM" do dia ISO informado em um timestamp ISO absoluto,
 * respeitando o fuso America/Sao_Paulo.
 */
export function localTimeToISO(dateISO: string, hhmm: string): string {
  const [y, mo, d] = dateISO.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  // Aproximação inicial em UTC, ajustada pelo offset real do fuso naquele instante.
  const guess = Date.UTC(y!, (mo ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0);
  const offset = tzOffsetMinutes(new Date(guess));
  return new Date(guess + offset * 60000).toISOString();
}

/** Offset (em minutos) que deve ser somado ao horário local para obter UTC. */
function tzOffsetMinutes(date: Date): number {
  const local = new Date(date.toLocaleString("en-US", { timeZone: TZ }));
  const utc = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  return Math.round((utc.getTime() - local.getTime()) / 60000);
}

/** Timestamp ISO -> "HH:MM" local, para inputs type="time". */
export function isoToInputTime(value: string | null | undefined): string {
  if (!value) return "";
  return formatTime(value);
}

export function minutesBetween(from: string | null, to: string | null): number {
  if (!from || !to) return 0;
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
}
