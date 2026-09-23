import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const TIME_ZONE = "America/Sao_Paulo";
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const numberFormatter = new Intl.NumberFormat("pt-BR");
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const isoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/**
 * dd/MM/yyyy. Datas de calendário ("2026-09-23", colunas `date`) são exibidas
 * como estão, sem conversão de fuso; timestamps são convertidos para São Paulo.
 */
export function formatDate(date: Date | string): string {
  if (typeof date === "string") {
    const m = CALENDAR_DATE.exec(date);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  return dateFormatter.format(new Date(date));
}

/** dd/MM/yyyy 'às' HH:mm no fuso de São Paulo. */
export function formatDateTime(date: Date | string): string {
  const d = new Date(date);
  return `${dateFormatter.format(d)} às ${timeFormatter.format(d)}`;
}

export function formatRelativeToNow(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { locale: ptBR, addSuffix: true });
}

/** "Hoje" em São Paulo como data de calendário (yyyy-MM-dd). */
export function todayInSaoPaulo(now: Date = new Date()): string {
  return isoDateFormatter.format(now);
}

/** Dias entre hoje (São Paulo) e uma data de calendário. Negativo = passou. */
export function daysUntil(
  calendarDate: string,
  now: Date = new Date(),
): number {
  const today = Date.parse(`${todayInSaoPaulo(now)}T00:00:00Z`);
  const target = Date.parse(`${calendarDate}T00:00:00Z`);
  return Math.round((target - today) / 86_400_000);
}

/** Soma meses a uma data de calendário, ajustando fim de mês (31/01 + 1 mês = 28/02). */
export function addMonthsToDate(calendarDate: string, months: number): string {
  const [y, m, d] = calendarDate.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Soma dias a uma data de calendário. */
export function addDaysToDate(calendarDate: string, days: number): string {
  const t = Date.parse(`${calendarDate}T00:00:00Z`) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** "vence em 12 dias", "vence hoje", "venceu há 3 dias". */
export function describeDue(
  calendarDate: string,
  now: Date = new Date(),
): string {
  const days = daysUntil(calendarDate, now);
  if (days === 0) return "vence hoje";
  if (days === 1) return "vence amanhã";
  if (days > 1) return `vence em ${days} dias`;
  if (days === -1) return "venceu ontem";
  return `venceu há ${-days} dias`;
}

export { TIME_ZONE };
