/**
 * Resolve a keyboard event into a pixel offset to lift UI above the keyboard.
 *
 * Both iOS and Android fire keyboard events, but the shape and meaning of the
 * payload differ:
 *
 *   - iOS reports `endCoordinates.screenY` (the top edge of the keyboard in
 *     window coordinates) and `endCoordinates.height`. We prefer screenY
 *     because it stays correct even when the device has a non-rectangular
 *     keyboard (e.g. iPad split keyboard). The offset is windowHeight - screenY.
 *   - Android 11+ reports `endCoordinates.height` only and only fires after
 *     the keyboard is actually shown. Older Androids may omit endCoordinates
 *     entirely.
 *
 * The function is defensive: a missing or malformed event resolves to 0
 * instead of throwing, so a bad native event cannot crash the JS thread.
 */
export function resolveKeyboardOffset(
  event:
    | {
        endCoordinates?: { height?: number; screenY?: number };
      }
    | undefined,
  windowHeight: number
): number {
  const screenY = event?.endCoordinates?.screenY;
  const eventHeight = event?.endCoordinates?.height ?? 0;
  return typeof screenY === 'number' ? Math.max(0, windowHeight - screenY) : eventHeight;
}
