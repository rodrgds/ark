export function sqliteBoolean(value: unknown) {
  return value === true || value === 1 || value === '1';
}
