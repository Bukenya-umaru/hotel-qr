export const money = value => new Intl.NumberFormat('en-UG', {
  style: 'currency', currency: 'UGX', maximumFractionDigits: 0,
}).format(value || 0)
