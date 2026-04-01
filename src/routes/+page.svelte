<script lang="ts">
	import { mdiLoading, mdiMapMarkerPath } from '@mdi/js';
	import openStreetMapLogo from '$lib/assets/openstreetmap.svg';
	import tflLogo from '$lib/assets/transportforlondon.svg';
	import {
		AppIcon,
		ConflictPanel,
		ItineraryTimeline,
		PlannerForm,
		PRIMARY_BUTTON_CLASS,
		PRIMARY_BUTTON_DISABLED_CLASS,
		SECONDARY_BUTTON_CLASS,
		StopsTable
	} from '$lib/components/planner';
	import { plannerStore } from '$lib/stores';
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
		startDate?: string;
		endDate?: string;
		planningDays: NonNullable<import('$lib/types/planner').PlannerSettings['planningDays']>;
	}): void {
		planner.setHotel(value.hotelName, value.hotelLat, value.hotelLng);
		planner.setSettings({
			dayStart: value.dayStart,
			dayEnd: value.dayEnd,
			mode: value.mode,
			preferences: value.preferences,
			dataSource: value.dataSource,
			startDate: value.startDate,
			endDate: value.endDate,
			planningDays: value.planningDays
		});
	}

	function handleAddPlace(value: {
		name: string;
		lat: number;
		lng: number;
		minimumDwellMinutes: number;
		openingTime?: string;
		closingTime?: string;
		fixedArrival: string;
		preferredDayId?: string;
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
				openingTime: value.openingTime || undefined,
				closingTime: value.closingTime || undefined,
				fixedArrival: value.fixedArrival || undefined,
				preferredDayId: value.preferredDayId || undefined,
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

	function optimizationStatusMessage(dataSource: RouteDataSource): { title: string; detail: string } {
		if (dataSource === 'tfl') {
			return {
				title: 'Fetching live TfL journeys',
				detail: 'Live public transport lookups can take a little longer while routes and fares are gathered for each leg.'
			};
		}

		if (dataSource === 'openstreet') {
			return {
				title: 'Calculating live street routes',
				detail: 'The planner is checking walking or cycling routes and rebuilding the itinerary around them.'
			};
		}

		return {
			title: 'Building your itinerary',
			detail: 'The planner is comparing route options, timings, and stop constraints now.'
		};
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
			<a href="#planner-setup" class={PRIMARY_BUTTON_CLASS}>
				Start planning
			</a>
			<button
				type="button"
				class={`${SECONDARY_BUTTON_CLASS} rounded-lg px-4 py-2 text-slate-900 ring-1 ring-slate-300`}
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
					dataSource: $planner.input.settings.dataSource ?? 'auto',
					startDate: $planner.input.settings.startDate,
					endDate: $planner.input.settings.endDate,
					planningDays: $planner.input.settings.planningDays ?? []
				}}
				stopCount={$planner.input.places.length}
				onSaveSettings={handleSaveSettings}
				onAddPlace={handleAddPlace}
			/>
			<StopsTable
				places={$planner.input.places}
				planningDays={$planner.input.settings.planningDays ?? []}
				onUpdate={handleUpdatePlace}
				onRemove={handleRemovePlace}
			/>

			<a href="#itinerary-section" class="sr-only" aria-label="Skip to itinerary and optimisation section">
				Skip to itinerary and optimisation
			</a>

			<div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="Quick actions">
				<p class="text-sm text-slate-700">Finished adding stops? Next step is to generate that itinerary.</p>
				<div class="mt-2 flex flex-wrap gap-2">
					<button
						type="button"
						class={PRIMARY_BUTTON_DISABLED_CLASS}
						onclick={optimize}
						disabled={$planner.isRunning || $planner.input.places.length === 0}
					>
						{$planner.isRunning ? 'Optimising...' : 'Generate Itinerary'}
					</button>
				</div>
				{#if $planner.isRunning}
					{@const status = optimizationStatusMessage($planner.input.settings.dataSource ?? 'auto')}
					<div class="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sky-950" role="status" aria-live="polite">
						<div class="flex items-start gap-3">
							<div class="mt-0.5 text-sky-700">
								<span class="loading-icon inline-flex"><AppIcon path={mdiLoading} size={16} decorative={true} /></span>
							</div>
							<div class="min-w-0">
								<p class="text-sm font-semibold text-sky-950">{status.title}</p>
								<p class="mt-1 text-sm text-sky-900">{status.detail}</p>
								<div class="mt-3 h-2 overflow-hidden rounded-full bg-sky-100">
									<div class="loading-bar h-full rounded-full bg-sky-500"></div>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</section>

	<section id="itinerary-section" class="mt-6 grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(18rem,1fr)]">
		<div class="min-w-0 space-y-6">
			<ItineraryTimeline input={$planner.input} result={$planner.result} onExportPdf={() => planner.exportPdf()} />
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

<style>
	.loading-icon {
		animation: spin 1s linear infinite;
	}

	.loading-bar {
		width: 40%;
		animation: loading-sweep 1.4s ease-in-out infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}

		to {
			transform: rotate(360deg);
		}
	}

	@keyframes loading-sweep {
		0% {
			transform: translateX(-110%);
		}

		50% {
			transform: translateX(120%);
		}

		100% {
			transform: translateX(260%);
		}
	}
</style>
