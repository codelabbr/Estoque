import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const TIME_ZONE = "America/Sao_Paulo";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatDate(date: Date | string): string {
  return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
}

export function formatDateTime(date: Date | string): string {
  return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function formatRelativeToNow(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { locale: ptBR, addSuffix: true });
}

export { TIME_ZONE };
