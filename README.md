# London Day Planner

London Day Planner is a SvelteKit app for building thoughtful London itineraries with timing, travel preferences, and practical route guidance in mind.

It is designed to be useful both for someone casually planning a day out and for someone who wants a clearer view of how stops, opening hours, and travel time fit together.

## What It Does

The planner helps you:

- set a hotel or starting point
- add places you would like to visit
- choose how you prefer to travel, including walking, cycling, and public transport
- account for opening hours, fixed booking times, and visit length
- spot conflicts when a plan becomes unrealistic
- generate an itinerary you can review, share, and export

## Highlights

- A local-first planning flow that keeps your current plan in the browser
- Support for single-day and multi-day planning
- London-focused place search to make hotel and stop entry easier
- Flexible routing with live providers when available and graceful fallback when not
- Printable PDF output for taking an itinerary with you
- Shareable preview links for sending a finished plan to someone else

## Getting Started

Install dependencies and start the development server:

```sh
pnpm install
pnpm dev
```

Useful checks:

```sh
pnpm check
pnpm build
```

## Optional Live Routing Setup

The app works without API keys, but some journey estimates will be more detailed when live routing is available.

Optional environment variables:

- `ORS_API_KEY` for OpenRouteService walking and cycling routes
- `TFL_APP_KEY` for TfL public transport journey data
- `ROUTE_SEGMENT_CACHE_TTL_MS` to adjust how long route responses are cached
- `ROUTING_DEBUG` to enable extra provider logging during development

If these are not set, the planner still works and falls back to built-in estimates where needed.

## Data Sources

The app can use:

- OpenStreetMap Nominatim for place search
- OpenRouteService for walking and cycling routes
- TfL journey data for public transport
- a heuristic fallback when live routing is unavailable

API-backed routing runs through the app's server routes so browser clients do not need direct access to provider keys.

## Project Layout

The project follows normal SvelteKit conventions, with pages and API endpoints under `src/routes` and reusable app code under `src/lib`.

The main areas are:

- `src/routes`: pages, preview routes, and API endpoints
- `src/lib/components/planner`: planner UI, grouped into `form`, `itinerary`, and `shared`
- `src/lib/services/planner`: planner-specific formatting, day handling, and orchestration helpers
- `src/lib/services/routing`: routing engine code used by the client-facing planner flow
- `src/lib/server/routing`: server-only provider integrations and shared provider helpers
- `src/lib/services/scheduler`: itinerary building and conflict handling
- `src/lib/services/export`: PDF and print export support
- `src/lib/stores`: application state management for the planner
- `src/lib/types`: core domain types used across the app

## Notes

- The project is London-focused by design.
- The codebase is organised to keep route files light and domain logic grouped by responsibility.
- Live routing is helpful, but it is not required for the planner to remain usable.
Copyright (c) ThatsOurJake (https://github.com/ThatsOurJake/mytrip-london)  
Licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE).
