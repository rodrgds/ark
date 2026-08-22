export function sqliteBoolean<T>(value: T) {
  return value === true || value === 1 || value === '1';
}
