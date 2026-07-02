# Ark Design Context

## Scene

Ark is used on a phone in daylight, a vehicle, a shelter, or a dark room during a practical task. The interface should feel stable, quiet, and ready under pressure.

## Theme

- Default to OLED for low-light and battery-conscious use.
- Keep dark and light modes readable in field conditions.
- Accent color controls preserve contrast and apply to primary actions, active selection, pins, and readiness indicators only.
- System theme follows the phone light/dark setting; true Android Material You accent extraction still needs a native resolved-color bridge.

## Current Visual System

- Styling: Tailwind CSS v4 with Uniwind.
- Components: shadcn-style primitives in `src/components/ui`.
- Shape: compact rounded rectangles, normally 8-10 px radius.
- Icons: lucide-react-native through `src/components/ui/icon.tsx`.
- Typography: native/system UI scale through the shared `Text` primitive.
- Default palette: neutral black/charcoal surfaces with muted green/amber survival-grade accent language.

## UI Direction

- Prefer dense but calm operational surfaces over decorative cards.
- Keep frequent actions visible; group secondary actions into menus or bottom sheets.
- Use progress only when it answers a user question. Collapse technical sub-steps behind a single human label unless diagnostics are open.
- Replace repeated status blocks with one authoritative status row and clear recovery action.
- Use sheets for contextual action groups, not for every confirmation.

## Quality Bar

- No crowded headers with four or five icon buttons.
- No duplicated "downloaded/ready/available" messaging in the same panel.
- No technical engine names in normal labels unless there is no user-facing synonym.
- Every download, index, model, and navigation state needs an obvious retry or details path.
