<script lang="ts">
	import { mdiMapMarkerPath } from '@mdi/js';
	import openStreetMapLogo from '$lib/assets/openstreetmap.svg';
	import tflLogo from '$lib/assets/transportforlondon.svg';
	import AppIcon from '$lib/components/planner/AppIcon.svelte';
	import { plannerStore } from '$lib/stores';
	import { ConflictPanel, ItineraryTimeline, PlannerForm, StopsTable } from '$lib/components/planner';
	import type { Place, RouteDataSource, TransportMode, TransportPreference } from '$lib/types/planner';

	const planner = plannerStore;

	function handleSaveSettings(value: {
		hotelName: string;
		hotelLat: number;
		hotelLng: number;
		dayStart: string;
		dayEnd: string;
		mode: TransportMode;
		preferences: TransportPreference[];
		dataSource: RouteDataSource;
	}): void {
		planner.setHotel(value.hotelName, value.hotelLat, value.hotelLng);
		planner.setSettings(value.dayStart, value.dayEnd, value.mode, value.preferences, value.dataSource);
	}

	function handleAddPlace(value: {
		name: string;
		lat: number;
		lng: number;
		minimumDwellMinutes: number;
		earliestArrival: string;
		latestArrival: string;
		fixedArrival: string;
		priority: number;
	}): void {
		planner.addPlace({
			name: value.name,
			location: {
				lat: value.lat,
				lng: value.lng
			},
			constraint: {
				minimumDwellMinutes: value.minimumDwellMinutes,
				earliestArrival: value.earliestArrival || undefined,
				latestArrival: value.latestArrival || undefined,
				fixedArrival: value.fixedArrival || undefined,
				priority: value.priority
			}
		});
	}

	function handleUpdatePlace(place: Place): void {
		planner.updatePlace(place);
	}

	function handleRemovePlace(id: string): void {
		planner.removePlace(id);
	}

	async function optimize(): Promise<void> {
		await planner.optimize();
	}
</script>

<svelte:head>
	<title>London Day Planner</title>
	<meta
		name="description"
		content="Plan an optimised London itinerary with timing constraints, mixed transport, and conflict alerts."
	/>
</svelte:head>

<a href="#main-content" class="skip-link">Skip to main content</a>

<main id="main-content" class="mx-auto max-w-7xl px-4 py-8 md:px-8">
	<header class="rounded-3xl border border-slate-300 bg-white/70 p-6 shadow-sm backdrop-blur">
		<p class="text-sm font-semibold uppercase tracking-wider text-teal-700">London UK Trip Optimiser</p>
		<h1 class="mt-2 text-3xl font-bold text-slate-900 md:text-4xl">Build a smart, time-aware day itinerary</h1>
		<p class="mt-3 max-w-3xl text-slate-700">
			Set your hotel, add places, enforce arrival constraints, and compare walking, cycling, or mixed transit routes.
			The planner highlights impossible schedules and tells you where time must be reduced.
		</p>

		<div class="mt-5 flex flex-wrap gap-3">
			<a href="#planner-setup" class="cursor-pointer rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700">
				Start planning
			</a>
			<button
				type="button"
				class="cursor-pointer rounded-lg bg-white px-4 py-2 font-medium text-slate-900 ring-1 ring-slate-300 hover:bg-slate-100"
				onclick={() => planner.reset()}
				disabled={$planner.input.places.length === 0 && !$planner.result}
			>
				Reset plan
			</button>
		</div>

		{#if $planner.error}
			<p class="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900" aria-live="polite">
				{$planner.error}
			</p>
		{/if}
	</header>

	<section id="planner-setup" class="mt-6 grid gap-6">
		<div class="min-w-0 space-y-6">
			<PlannerForm
				value={{
					hotelName: $planner.input.hotel.name,
					hotelLat: $planner.input.hotel.location.lat,
					hotelLng: $planner.input.hotel.location.lng,
					dayStart: $planner.input.settings.dayStart,
					dayEnd: $planner.input.settings.dayEnd,
					mode: $planner.input.settings.mode,
					preferences: $planner.input.settings.preferences ?? ['walking'],
					dataSource: $planner.input.settings.dataSource ?? 'auto'
				}}
				stopCount={$planner.input.places.length}
				onSaveSettings={handleSaveSettings}
				onAddPlace={handleAddPlace}
			/>
			<StopsTable places={$planner.input.places} onUpdate={handleUpdatePlace} onRemove={handleRemovePlace} />

			<a href="#itinerary-section" class="sr-only" aria-label="Skip to itinerary and optimisation section">
				Skip to itinerary and optimisation
			</a>

			<div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="Quick actions">
				<p class="text-sm text-slate-700">Finished adding stops? Next step is to optimise.</p>
				<div class="mt-2 flex gap-2">
					<button
						type="button"
						class="cursor-pointer rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
						onclick={optimize}
						disabled={$planner.isRunning || $planner.input.places.length === 0}
					>
						{$planner.isRunning ? 'Optimising...' : 'Optimise now'}
					</button>
					<button
						type="button"
						class="cursor-pointer rounded-lg bg-indigo-900 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-indigo-300"
						onclick={() => planner.exportPdf()}
						disabled={!$planner.result}
					>
						Export PDF
					</button>
				</div>
			</div>
		</div>
	</section>

	<section id="itinerary-section" class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(18rem,1fr)]">
		<div class="min-w-0 space-y-6">
			<ItineraryTimeline input={$planner.input} result={$planner.result} />
		</div>
		<div class="min-w-0 space-y-6">
			<ConflictPanel result={$planner.result} />
		</div>
	</section>

	<footer class="mt-8 rounded-xl border border-slate-200 bg-white/80 p-4 text-xs text-slate-700">
		<p class="font-semibold text-slate-900">Data sources used</p>
		<div class="mt-3 flex flex-wrap gap-2">
			<a
				href="https://api-portal.tfl.gov.uk/"
				target="_blank"
				rel="noreferrer"
				class="inline-flex items-center gap-2 rounded-full bg-[#113b92] px-3 py-1 font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#113b92]"
				aria-label="Open the TfL Unified API website in a new tab"
			>
				<img src={tflLogo} alt="" class="h-4 w-4 rounded-full bg-white p-0.5" />
				TfL Unified API
			</a>
			<a
				href="https://nominatim.openstreetmap.org/"
				target="_blank"
				rel="noreferrer"
				class="inline-flex items-center gap-2 rounded-full bg-[#7ebc6f] px-3 py-1 font-semibold text-slate-900 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4d7c0f]"
				aria-label="Open the OpenStreetMap Nominatim website in a new tab"
			>
				<img src={openStreetMapLogo} alt="" class="h-4 w-4 rounded-full bg-white p-0.5" />
				OpenStreetMap Nominatim
			</a>
			<span class="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 font-semibold text-white">
				<AppIcon path={mdiMapMarkerPath} size={14} decorative={true} />
				Heuristic fallback
			</span>
		</div>
		<p class="mt-3">
			Routing uses
			<a href="https://api-portal.tfl.gov.uk/" target="_blank" rel="noreferrer" class="font-semibold text-slate-900 underline underline-offset-2">
				TfL Unified API
			</a>,
			<a href="https://openrouteservice.org/" target="_blank" rel="noreferrer" class="font-semibold text-slate-900 underline underline-offset-2">
				OpenRouteService
			</a>, and a heuristic fallback when live routing is unavailable. Location search uses
			<a href="https://nominatim.openstreetmap.org/" target="_blank" rel="noreferrer" class="font-semibold text-slate-900 underline underline-offset-2">
				OpenStreetMap Nominatim
			</a>.
		</p>
	</footer>
</main>
