export function isProductionEnv(nodeEnv?: string | null): boolean {
  return String(nodeEnv ?? '').trim().toLowerCase() === 'production';
}

export function parseBooleanFlag(
  value: string | boolean | number | null | undefined,
  defaultValue = false,
): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return defaultValue;

  switch (value.trim().toLowerCase()) {
    case '1':
    case 'true':
    case 'yes':
    case 'on':
      return true;
    case '0':
    case 'false':
    case 'no':
    case 'off':
      return false;
    default:
      return defaultValue;
  }
}
