export const formatCurrency = (value: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

export const formatPercent = (value: number, fractionDigits = 2) =>
  `${value.toFixed(fractionDigits)}%`;

export const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value);
