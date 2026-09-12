export const EXPENSE_CATEGORIES = [
  { id: "fuel", label: "Combustível", icon: "⛽" },
  { id: "food", label: "Alimentação", icon: "🍽️" },
  { id: "toll", label: "Pedágio", icon: "🛣️" },
  { id: "tour", label: "Passeios", icon: "🎫" },
  { id: "lodging", label: "Hospedagem", icon: "🏨" },
  { id: "transport", label: "Transporte", icon: "🚆" },
  { id: "shopping", label: "Compras", icon: "🛍️" },
  { id: "other", label: "Outros", icon: "📦" },
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["id"];

export const ASSET_CATEGORIES = [
  { id: "hotel_voucher", label: "Voucher de hotel", icon: "🏨", kind: "document" },
  { id: "flight", label: "Passagem aérea", icon: "✈️", kind: "document" },
  { id: "train", label: "Passagem de trem", icon: "🚆", kind: "document" },
  { id: "ticket", label: "Ingresso", icon: "🎫", kind: "document" },
  { id: "receipt", label: "Recibo", icon: "🧾", kind: "document" },
  { id: "insurance", label: "Seguro / documento pessoal", icon: "🛡️", kind: "document" },
  { id: "photo", label: "Fotografia", icon: "📷", kind: "photo" },
  { id: "audio", label: "Áudio", icon: "🎧", kind: "audio" },
  { id: "map_link", label: "Mapa (link)", icon: "🗺️", kind: "link" },
  { id: "gps_route", label: "Rota GPS", icon: "⌖", kind: "link" },
  { id: "other", label: "Outro", icon: "📄", kind: "document" },
] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number]["id"];

export const ACTIVITY_TYPES = [
  { id: "transfer", label: "Deslocamento", icon: "🚗" },
  { id: "flight", label: "Voo", icon: "✈️" },
  { id: "train", label: "Trem", icon: "🚆" },
  { id: "lodging", label: "Hospedagem", icon: "🏨" },
  { id: "meal", label: "Refeição", icon: "🍽️" },
  { id: "visit", label: "Visita / passeio", icon: "📍" },
  { id: "other", label: "Outro", icon: "•" },
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number]["id"];

export const CURRENCIES = [
  { code: "BRL", symbol: "R$", name: "Real" },
  { code: "USD", symbol: "$", name: "Dólar americano" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "Libra" },
  { code: "ARS", symbol: "$", name: "Peso argentino" },
  { code: "CLP", symbol: "$", name: "Peso chileno" },
  { code: "UYU", symbol: "$", name: "Peso uruguaio" },
  { code: "JPY", symbol: "¥", name: "Iene" },
  { code: "CHF", symbol: "CHF", name: "Franco suíço" },
  { code: "CAD", symbol: "C$", name: "Dólar canadense" },
  { code: "MXN", symbol: "$", name: "Peso mexicano" },
] as const;
export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export function categoryLabel(id: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
export function categoryIcon(id: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.id === id)?.icon ?? "📦";
}
export function assetCategoryMeta(id: string) {
  return ASSET_CATEGORIES.find((c) => c.id === id) ?? ASSET_CATEGORIES[ASSET_CATEGORIES.length - 1]!;
}
