# Map Search Upgrade Spec

## 1. Scope

Applies to:

- `src/app/(dashboard)/map` (customer map)
- `src/app/(dashboard)/node-map` (node map)

Goals:

- Improve search UX consistency
- Reduce client-side filtering cost
- Keep map interactions responsive when dataset grows

Non-goals:

- Rebuild map rendering engine
- Introduce full-text search infrastructure (Elastic, Meilisearch) in this phase

## 2. Current Problems

- Search currently filters large in-memory arrays on client.
- Marker updates can happen too often while user types.
- Behavior differs between customer map and node map.
- No request cancellation/debounce contract at API level.
- Mixed search fields with no explicit ranking strategy.

## 3. Target UX

Common behavior for both screens:

1. User types in search input.
2. Wait 300ms debounce before request.
3. Cancel previous in-flight request when new input arrives.
4. Show one of states:
   - `Idle` (no input)
   - `Searching`
   - `No results`
   - `Results`
5. Keyboard support:
   - `ArrowDown/ArrowUp`: move active row
   - `Enter`: select active row
   - `Escape`: close result panel
6. On select:
   - Fly to coordinate
   - Open popup/highlight marker
   - Close mobile search sheet

## 4. API Design

### 4.1 Customer map search

`GET /api/customers/search-map`

Query params:

- `q` (string, required if searching)
- `limit` (number, default 20, max 50)
- `cursor` (optional for pagination)

Response:

```json
{
  "items": [
    {
      "id": "cus_123",
      "name": "Nguyen Van A",
      "phone": "09xxxx",
      "account": "acc_01",
      "ctvCode": "CTV01",
      "latitude": 11.53,
      "longitude": 107.95,
      "status": "Hoat dong"
    }
  ],
  "nextCursor": null
}
```

Search ranking (descending):

1. exact phone/account
2. prefix match phone/account/name
3. contains name/ctv/address

### 4.2 Node map search

`GET /api/nodes/search-map`

Query params:

- `q` (string)
- `limit` (default 20, max 50)

Behavior:

- If input parses to `lat,lng`: return nearest nodes sorted by distance.
- Else: text search by node name/description.

Response:

```json
{
  "items": [
    {
      "id": "node_01",
      "name": "Node A-01",
      "description": "Backbone",
      "latitude": 11.54,
      "longitude": 107.96,
      "distanceKm": 1.2
    }
  ]
}
```

## 5. Backend/Data

### 5.1 DB indexes (Prisma/SQL migration)

Customers:

- `name`
- `phone`
- `account`
- `ctvCode`
- composite optional: `(latitude, longitude)` for map-only subsets

Nodes:

- `name`
- optional `description`

### 5.2 Normalization

Before query:

- trim whitespace
- lowercase
- normalize Vietnamese accents strategy:
  - Phase 1: keep as-is
  - Phase 2: add accent-insensitive column if needed

## 6. Frontend Architecture

Create shared hook:

- `src/hooks/useMapSearch.ts`

Responsibilities:

- debounce input
- abort stale requests
- expose state machine (`idle/searching/results/empty/error`)
- keyboard active index
- simple LRU cache by `query+scope`

Map screens only handle:

- render input/panel
- call `onSelectResult`
- fly/open marker

## 7. Performance Plan

Targets:

- keystroke-to-first-result < 250ms (warm)
- map interaction remains smooth while searching

Key tactics:

- avoid filtering full marker arrays per keystroke
- update only selected/highlight state, not full marker layer
- keep cluster layer stable
- fetch limited result list only

## 8. Rollout Plan (1 sprint)

### Day 1-2

- Add APIs: `/api/customers/search-map`, `/api/nodes/search-map`
- Add DB indexes migration

### Day 3-4

- Implement shared `useMapSearch` hook
- Replace current local filtering logic in both map screens

### Day 5

- Keyboard + mobile sheet UX polish
- Add loading/empty/error states

### Day 6

- QA large dataset, race condition, mobile behavior
- Measure response time and dropped requests

### Day 7

- Stabilization + release notes

## 9. Acceptance Criteria

- Both screens use same search interaction pattern.
- Debounce + request cancellation works (no stale overwrite).
- Search no longer depends on filtering full in-memory list.
- Mobile search panel is usable one-handed.
- No regressions in map fly-to and popup opening behavior.
