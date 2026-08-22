/**
 * Decode helpers for values whose type TypeScript cannot see: JSON payloads,
 * caught errors, and other untyped boundaries. Each helper takes a generic
 * parameter so callers keep their own type evidence; representation checks
 * live here and nowhere else.
 */

type JsonPrimitive = string | number | boolean | null;

/** Structural JSON value: anything JSON.parse can return. */
export type Json = JsonPrimitive | Json[] | { [key: string]: Json };

export function isJsonString<T>(value: T): value is T & string {
  return typeof value === 'string';
}

export function isJsonNumber<T>(value: T): value is T & number {
  return typeof value === 'number';
}

export function isJsonObject<T>(value: T): value is T & { [key: string]: Json } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True when `value` is an object carrying a usable string `message`, the useful part of a thrown value. */
export function isErrorLike<T>(value: T): value is T & { message: string } {
  if (!isJsonObject(value)) return false;
  return 'message' in value && isJsonString(value.message) && value.message.trim().length > 0;
}

/** Best readable message from a thrown value without assuming it is an Error. */
export function errorMessage<T>(value: T): string {
  if (isErrorLike(value)) return value.message;
  return String(value);
}
