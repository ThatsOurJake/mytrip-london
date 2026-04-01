# London Day Planner

A strongly typed SvelteKit application for building time-aware London itineraries.

## Features

- Hotel anchor + places of interest input
- Transport preferences: walking plus optional cycling or public transport
- Fixed-time activities (hard constraints)
- Minimum dwell times per place
- Conflict detection with actionable guidance
- Local persistence (browser storage)
- Printable PDF itinerary export

## Stack

- SvelteKit + TypeScript (strict mode)
- Tailwind CSS 4
- Modular service architecture for routing, optimization, scheduling, and export

## Run

```sh
pnpm install
pnpm dev
```

Checks:

```sh
pnpm check
pnpm build
```

## Optional Environment Variables

These are optional. If absent, the app automatically falls back to heuristic routing.

- `ORS_API_KEY`: OpenRouteService key for live walking/cycling durations (server-side only)
- `TFL_APP_KEY`: TfL Unified API key for mixed mode transit legs (server-side only)
- `ROUTE_SEGMENT_CACHE_TTL_MS`: TTL in milliseconds for cached `/api/route-segment` responses
- `ROUTING_DEBUG`: Enable provider request lifecycle logging without exposing raw API payloads

Routing calls are proxied through `src/routes/api/route-segment/+server.ts` so API keys are never exposed to the browser.
Matching route-segment requests are cached on the server for 30 minutes by default to reduce repeated TfL and ORS calls.

## Geocoding and Autocomplete

- Service used: OpenStreetMap Nominatim search API
- API key required: No
- Scope in app: hotel and place search autocomplete with London-biased results

## Project Structure

- `src/lib/types/planner.ts`: Core domain types
- `src/lib/services/routing/*`: Routing providers + caching engine
- `src/lib/services/optimizer/solver.ts`: Route ordering heuristic
- `src/lib/services/scheduler/*`: Timeline builder + conflict analysis
- `src/lib/services/export/pdf.ts`: Print-friendly PDF export
- `src/lib/stores/planner-store.ts`: Stateful planner orchestration
- `src/lib/components/planner/*`: UI components
- `src/routes/+page.svelte`: Main planner page

## Notes

- The MVP is intentionally single-day and local-first.
- Routing provider calls are resilient: live API first, heuristic fallback second.
