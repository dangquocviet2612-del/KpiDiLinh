# UI Patterns In This Repo

## Shared Design Language

- shared actions live in `src/app/globals.css`
- feature styling usually lives in local `*.module.css`
- icons use `lucide-react`

## Screen Archetypes

### Data management

Examples:
- `customers`
- `ctv`
- `logs`

Pattern:
- compact header
- single toolbar
- dense table on desktop
- card list on mobile

### Map screen

Examples:
- `map`
- `node-map`

Pattern:
- map is primary
- overlays should be slim
- search + key actions + filter chips
- popup should read in 2-3 seconds

### Reporting / KPI

Examples:
- `prepaid`
- `archive`

Pattern:
- summary first
- filters second
- data grid/list third
- avoid duplicate totals in too many places

### Utility workspace

Examples:
- `/tools`

Pattern:
- use near-full-width layout
- reduce dashboard chrome
- let the tool own the screen

## Common Problems To Avoid

- too many stacked control panels on mobile
- every field styled as equally important
- chips used where plain text would read better
- desktop table forced into mobile without restructuring
- multiple competing headers/toolbars

## Module Priorities

- `customers`: search + actions + table/card
- `map`: search + minimal controls + popup clarity
- `node-map`: search + style toggle + filter + popup clarity
- `prepaid`: filter density without vertical bloat
- `official-docs`: inbox/list vs editor/detail separation
- `ctv`: compact admin layout
