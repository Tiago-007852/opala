// Formata valores em kwanzas: 7000 -> "7.000"
export const formatKz = (value: number): string =>
  Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
