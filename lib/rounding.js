// Bill rounding helpers. Round the grand total to the nearest step using the
// configured mode (none / nearest / up / down). Returns { rounded, adjustment }.

export const ROUNDING_MODES = ['none', 'nearest', 'up', 'down'];

export function applyRounding(amount, { rounding_mode, rounding_step } = {}) {
  const value = Number(amount) || 0;
  const step = Math.max(0, Number(rounding_step) || 0);
  const mode = ROUNDING_MODES.includes(rounding_mode) ? rounding_mode : 'none';
  if (mode === 'none' || step <= 0) return { rounded: value, adjustment: 0 };

  let rounded;
  if (mode === 'up') rounded = Math.ceil(value / step) * step;
  else if (mode === 'down') rounded = Math.floor(value / step) * step;
  else rounded = Math.round(value / step) * step;

  return { rounded, adjustment: rounded - value };
}
