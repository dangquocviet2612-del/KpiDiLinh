# Node 0TB Map Hardening Design

## Goal

Bring `/node-0tb` to the same safety, accessibility, and responsive interaction standard as `/map` and `/node-map` without changing its API, import format, permissions, or business rules.

## Approved Scope

- Request browser location only after an explicit user action and show progress or a useful permission error.
- Show load failures on the map with a retry action instead of silently rendering an empty state.
- Make search, filters, menus, and the list panel expose their state to assistive technology.
- Add zoom in, zoom out, and fit-visible-node controls.
- Use keyless OpenStreetMap tiles for light/dark modes so the map never renders provider API-key watermarks.
- Keep the top toolbar to one operational row; totals remain available in the filter chips and map count pill.
- Keep the list panel usable as a mobile bottom sheet through the shared node-map styles.
- Escape popup content and route clipboard actions through a safe encoded event instead of embedding raw values in inline JavaScript.
- Remove stale imports and state that currently produce lint warnings.

## Architecture

`Node0TbMap.tsx` remains the owning client component. It continues to call `/api/node-0tb` and `/api/node-0tb/upload`, render Leaflet clusters, and reuse `node-map.module.css`. Small HTML/event encoding logic lives in `src/lib/map-ui.ts` so it is independently testable and shared with other map screens.

## Interaction Design

- The map remains the primary canvas; overlays stay compact.
- Search behaves as a combobox and results remain keyboard-selectable through `MapSearchResults`.
- Selecting a search/list result clears an incompatible category filter before opening its marker.
- GPS is never requested on initial page load.
- Loading errors provide a clear retry button.
- Admin/style menus expose expanded state and menu relationships.
- The node list exposes a labelled dialog region and touch-friendly controls on mobile.

## Error Handling

- Non-2xx responses and malformed node payloads become a visible load error.
- Geolocation unsupported, denied, or timed out states are surfaced through the existing toast system and button title.
- Nodes without coordinates keep their existing user-facing warning behavior.

## Verification

- Add a failing unit test for safe map event encoding before implementing the helper.
- Run focused tests and ESLint after each implementation batch.
- Finish with the full Vitest suite, ESLint, TypeScript, `git diff --check`, and a production build.

## Out of Scope

- API/schema changes, import format changes, viewport-based server fetching, and splitting the large map component into multiple files.
