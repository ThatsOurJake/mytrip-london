<script lang="ts">
	import { mdiAlphaECircleOutline, mdiBike, mdiBusDoubleDecker, mdiSubway, mdiTrain, mdiWalk } from '@mdi/js';
	import AppIcon from './AppIcon.svelte';
	import InfoPopover from './InfoPopover.svelte';
	import LocationAutocomplete from './LocationAutocomplete.svelte';
	import {
		TRANSIT_PREFERENCES,
		type RouteDataSource,
		type TransitPreference,
		type TransportMode,
		type TransportPreference
	} from '$lib/types/planner';
	import type { LocationSuggestion } from '$lib/services/geocode';

	const PREFERENCE_ORDER: TransportPreference[] = ['walking', 'cycling', ...TRANSIT_PREFERENCES];
	const TRANSIT_PREFERENCE_SET = new Set<TransitPreference>(TRANSIT_PREFERENCES);
	const activeTravelOptions: Array<{
		preference: 'walking' | 'cycling';
		label: string;
		description: string;
		icon: string;
		disabled?: boolean;
	}> = [
		{
			preference: 'walking',
			label: 'Walking',
			description: 'Always on for short links and station access.',
			icon: mdiWalk,
			disabled: true
		},
		{
			preference: 'cycling',
			label: 'Cycling',
			description: 'Prefer bike routing instead of TfL services.',
			icon: mdiBike
		}
	];
	const transitOptions: Array<{
		preference: TransitPreference;
		label: string;
		description: string;
		icon: string;
	}> = [
		{
			preference: 'tube',
			label: 'Tube',
			description: 'Underground, Overground and DLR.',
			icon: mdiSubway
		},
		{
			preference: 'bus',
			label: 'Bus',
			description: 'TfL bus routing with walking connectors.',
			icon: mdiBusDoubleDecker
		},
		{
			preference: 'train',
			label: 'Train',
			description: 'National Rail and tram services.',
			icon: mdiTrain
		},
		{
			preference: 'elizabeth',
			label: 'Elizabeth',
			description: 'Use Elizabeth line journeys where available.',
			icon: mdiAlphaECircleOutline
		}
	];
	const dataSourceOptions: Array<{
		value: RouteDataSource;
		label: string;
		description: string;
	}> = [
		{
			value: 'auto',
			label: 'Recommended',
			description: 'Use the best live provider for each trip, then fall back when needed.'
		},
		{
			value: 'tfl',
			label: 'TfL',
			description: 'Prefer TfL journey data for public transport routing across London.'
		},
		{
			value: 'openstreet',
			label: 'OpenStreet',
			description: 'Prefer OpenStreet routing for walking and cycling segments.'
		},
		{
			value: 'heuristic',
			label: 'Heuristic',
			description: 'Use built-in estimates only, without live routing requests.'
		}
	];

	interface PlannerFormValue {
		hotelName: string;
		hotelLat: number;
		hotelLng: number;
		dayStart: string;
		dayEnd: string;
		mode: TransportMode;
		preferences: TransportPreference[];
		dataSource: RouteDataSource;
	}

	interface PlaceDraftValue {
		name: string;
		lat: number;
		lng: number;
		minimumDwellMinutes: number;
		earliestArrival: string;
		latestArrival: string;
		fixedArrival: string;
		priority: number;
	}

	let {
		value,
		stopCount,
		onSaveSettings,
		onAddPlace,
		onSettingsSaved = () => undefined
	}: {
		value: PlannerFormValue;
		stopCount: number;
		onSaveSettings: (next: PlannerFormValue) => void;
		onAddPlace: (next: PlaceDraftValue) => void;
		onSettingsSaved?: () => void;
	} = $props();

	let hotelName = $state('');
	let hotelLat = $state('');
	let hotelLng = $state('');
	let dayStart = $state('08:30');
	let dayEnd = $state('21:00');
	let mode = $state<TransportMode>('walking');
	let preferences = $state<TransportPreference[]>(['walking']);
	let dataSource = $state<RouteDataSource>('auto');

	$effect(() => {
		hotelName = value.hotelName;
		hotelLat = value.hotelLat.toString();
		hotelLng = value.hotelLng.toString();
		dayStart = value.dayStart;
		dayEnd = value.dayEnd;
		mode = value.mode;
		preferences = [...value.preferences];
		dataSource = value.dataSource;
	});

	let placeName = $state('');
	let placeLat = $state('51.509865');
	let placeLng = $state('-0.118092');
	let minimumDwellMinutes = $state('90');
	let earliestArrival = $state('');
	let latestArrival = $state('');
	let fixedArrival = $state('');
	let priority = $state('5');
	let hotelSearchQuery = $state('');
	let placeSearchQuery = $state('');
	let saveStatus = $state('');

	function orderPreferences(nextPreferences: Iterable<TransportPreference>): TransportPreference[] {
		const nextSet = new Set(nextPreferences);
		return PREFERENCE_ORDER.filter((preference) => nextSet.has(preference));
	}

	function hasTransitPreference(nextPreferences: Iterable<TransportPreference>): boolean {
		for (const preference of nextPreferences) {
			if (TRANSIT_PREFERENCE_SET.has(preference as TransitPreference)) {
				return true;
			}
		}

		return false;
	}

	function modeFromPreferences(nextPreferences: TransportPreference[]): TransportMode {
		if (hasTransitPreference(nextPreferences)) {
			return 'mixed';
		}

		if (nextPreferences.includes('cycling')) {
			return 'cycling';
		}

		return 'walking';
	}

	function togglePreference(preference: TransportPreference): void {
		if (preference === 'walking') {
			return;
		}

		const next = new Set(preferences);
		const isSelected = next.has(preference);
		if (isSelected) {
			next.delete(preference);
		} else {
			next.add(preference);
			if (preference === 'cycling') {
				for (const transitPreference of TRANSIT_PREFERENCES) {
					next.delete(transitPreference);
				}
			} else if (TRANSIT_PREFERENCE_SET.has(preference as TransitPreference)) {
				next.delete('cycling');
			}
		}

		next.add('walking');
		preferences = orderPreferences(next);
		mode = modeFromPreferences(preferences);
	}

	function hasPreference(preference: TransportPreference): boolean {
		return preferences.includes(preference);
	}

	function hasPendingTripChanges(): boolean {
		return (
			hotelName !== value.hotelName ||
			hotelLat !== value.hotelLat.toString() ||
			hotelLng !== value.hotelLng.toString() ||
			dayStart !== value.dayStart ||
			dayEnd !== value.dayEnd ||
			mode !== value.mode ||
			preferences.join('|') !== value.preferences.join('|') ||
			dataSource !== value.dataSource
		);
	}

	function saveSettings(): void {
		onSaveSettings({
			hotelName,
			hotelLat: Number(hotelLat),
			hotelLng: Number(hotelLng),
			dayStart,
			dayEnd,
			mode,
			preferences,
			dataSource
		});
		saveStatus = 'Trip details saved.';
		onSettingsSaved();
	}

	function selectionSummary(): string {
		if (hasTransitPreference(preferences)) {
			return `Walking plus ${preferences
				.filter((preference) => TRANSIT_PREFERENCE_SET.has(preference as TransitPreference))
				.map((preference) => transitOptions.find((option) => option.preference === preference)?.label.toLowerCase() ?? preference)
				.join(', ')}.`;
		}

		if (preferences.includes('cycling')) {
			return 'Walking plus cycling.';
		}

		return 'Walking only.';
	}

	function dataSourceNotice(): string {
		if (dataSource === 'openstreet' && mode === 'mixed') {
			return 'OpenStreet routing does not include London public transport, so mixed trips may fall back to heuristic segments.';
		}

		if (dataSource === 'tfl' && mode !== 'mixed') {
			return 'TfL routing is strongest for public transport journeys. Walking or cycling-only trips may still fall back if needed.';
		}

		return dataSourceOptions.find((option) => option.value === dataSource)?.description ?? '';
	}

	function setHotelFromSuggestion(location: LocationSuggestion): void {
		hotelSearchQuery = location.label;
		hotelName = location.label.split(',')[0]?.trim() || location.label;
		hotelLat = location.lat.toFixed(6);
		hotelLng = location.lng.toFixed(6);
	}

	function setPlaceFromSuggestion(location: LocationSuggestion): void {
		placeSearchQuery = location.label;
		placeName = location.label.split(',')[0]?.trim() || location.label;
		placeLat = location.lat.toFixed(6);
		placeLng = location.lng.toFixed(6);
	}

	function addPlace(): void {
		const addedPlaceName = placeName;

		onAddPlace({
			name: placeName,
			lat: Number(placeLat),
			lng: Number(placeLng),
			minimumDwellMinutes: Number(minimumDwellMinutes),
			earliestArrival,
			latestArrival,
			fixedArrival,
			priority: Number(priority)
		});

		placeName = '';
		placeSearchQuery = '';
		earliestArrival = '';
		latestArrival = '';
		fixedArrival = '';
	}
</script>

<section aria-labelledby="planner-config-title" class="rounded-2xl border border-slate-300 bg-white/90 p-5 shadow-sm">
	<h2 id="planner-config-title" class="text-xl font-semibold text-slate-900">Trip settings</h2>
	<p class="mt-1 text-sm text-slate-700">
		These settings define the base for optimisation: your hotel, travel mode, and day time window.
	</p>

	<div class="mt-4 grid gap-6 lg:grid-cols-2">
		<div class="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
			<h3 class="text-base font-semibold text-slate-900">Start point and trip details</h3>
			<div class="mt-3 space-y-3">
			<LocationAutocomplete
				label="Hotel search (London)"
				value={hotelSearchQuery}
				placeholder="Search for your hotel"
				onSelect={setHotelFromSuggestion}
			/>
				<label class="flex flex-col gap-1">
					<span class="text-sm font-medium text-slate-700">Hotel display name</span>
					<input bind:value={hotelName} class="field" type="text" placeholder="The Savoy" />
				</label>

				<div class="grid gap-3 sm:grid-cols-2">
					<label class="flex flex-col gap-1">
						<span class="text-sm font-medium text-slate-700">Hotel latitude</span>
						<input bind:value={hotelLat} class="field" inputmode="decimal" type="text" />
					</label>
					<label class="flex flex-col gap-1">
						<span class="text-sm font-medium text-slate-700">Hotel longitude</span>
						<input bind:value={hotelLng} class="field" inputmode="decimal" type="text" />
					</label>
				</div>

				<fieldset class="space-y-2 sm:col-span-1">
					<legend class="text-sm font-medium text-slate-700">Transport preferences</legend>
					<p class="text-sm text-slate-600">Walking stays enabled. Pick cycling or combine the TfL services you want to allow.</p>
					<div class="space-y-3">
						<div>
							<p class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Active travel</p>
							<div class="grid gap-2 sm:grid-cols-2">
								{#each activeTravelOptions as option}
									<label class={`transport-option ${hasPreference(option.preference) ? 'transport-option-active' : ''} ${option.disabled ? 'transport-option-disabled' : ''}`}>
										<input
											class="sr-only"
											type="checkbox"
											checked={hasPreference(option.preference)}
											disabled={option.disabled}
											onchange={() => togglePreference(option.preference)}
										/>
										<span class="transport-icon">
											<AppIcon path={option.icon} size={18} label={option.label} />
										</span>
										<span class="min-w-0">
											<span class="block font-medium text-slate-900">{option.label}</span>
											<span class="block text-xs text-slate-600">{option.description}</span>
										</span>
									</label>
								{/each}
							</div>
						</div>
						<div>
							<p class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">TfL services</p>
							<div class="grid gap-2 sm:grid-cols-2">
								{#each transitOptions as option}
									<label class={`transport-option ${hasPreference(option.preference) ? 'transport-option-active' : ''}`}>
										<input
											class="sr-only"
											type="checkbox"
											checked={hasPreference(option.preference)}
											onchange={() => togglePreference(option.preference)}
										/>
										<span class="transport-icon">
											<AppIcon path={option.icon} size={18} label={option.label} />
										</span>
										<span class="min-w-0">
											<span class="block font-medium text-slate-900">{option.label}</span>
											<span class="block text-xs text-slate-600">{option.description}</span>
										</span>
									</label>
								{/each}
							</div>
						</div>
					</div>
					<p class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{selectionSummary()}</p>
				</fieldset>

				<fieldset class="space-y-2 sm:col-span-1">
					<legend class="text-sm font-medium text-slate-700">Route data source</legend>
					<p class="text-sm text-slate-600">Choose how the planner should source route times and geometry.</p>
					<div class="grid gap-2 sm:grid-cols-2">
						{#each dataSourceOptions as option}
							<label class={`transport-option ${dataSource === option.value ? 'transport-option-active' : ''}`}>
								<input
									class="sr-only"
									type="radio"
									name="route-data-source"
									value={option.value}
									checked={dataSource === option.value}
									onchange={() => (dataSource = option.value)}
								/>
								<span class="min-w-0">
									<span class="block font-medium text-slate-900">{option.label}</span>
									<span class="block text-xs text-slate-600">{option.description}</span>
								</span>
							</label>
						{/each}
					</div>
					<p class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{dataSourceNotice()}</p>
				</fieldset>

				<div class="grid gap-3 sm:grid-cols-2">
					<label class="flex flex-col gap-1 sm:col-span-1">
						<span class="text-sm font-medium text-slate-700">Day start</span>
						<input bind:value={dayStart} class="field" type="time" />
					</label>
					<label class="flex flex-col gap-1 sm:col-span-1">
						<span class="text-sm font-medium text-slate-700">Day end</span>
						<input bind:value={dayEnd} class="field" type="time" />
					</label>
				</div>

				{#if hasPendingTripChanges()}
					<p class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status" aria-live="polite">
						You changed trip details. Save them before you optimise.
					</p>
				{/if}
				<button
					class="inline-flex cursor-pointer rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-700"
					type="button"
					onclick={saveSettings}
				>
					Save start point and trip details
				</button>
				{#if saveStatus}
					<p class="text-sm text-emerald-800" role="status" aria-live="polite">
						{saveStatus} Optimisation and itinerary generation now use these values.
					</p>
				{/if}
			</div>
		</div>

		<div class="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
			<h3 class="text-base font-semibold text-slate-900">Add place</h3>
			<p class="mt-1 text-sm text-slate-700">Search a place first, then adjust its timing constraints.</p>
			<div class="mt-3">
				<LocationAutocomplete
					label="Find place in London"
					value={placeSearchQuery}
					placeholder="Search museum, park, attraction..."
					onSelect={setPlaceFromSuggestion}
				/>
			</div>
			<div class="mt-3 grid gap-3 md:grid-cols-2">
				<label class="flex flex-col gap-1 md:col-span-2">
					<span class="text-sm font-medium text-slate-700">Place name</span>
					<input bind:value={placeName} class="field" type="text" placeholder="British Museum" />
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-sm font-medium text-slate-700">Latitude</span>
					<input bind:value={placeLat} class="field" inputmode="decimal" type="text" />
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-sm font-medium text-slate-700">Longitude</span>
					<input bind:value={placeLng} class="field" inputmode="decimal" type="text" />
				</label>
				<label class="flex flex-col gap-1">
					<span class="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
						Minimum dwell time (minutes)
						<InfoPopover label="Minimum dwell time" content="The least time you want to spend at this place. The planner keeps at least this many minutes in the itinerary." />
					</span>
					<input bind:value={minimumDwellMinutes} class="field" inputmode="numeric" min="10" step="5" type="number" />
				</label>
				<label class="flex flex-col gap-1">
					<span class="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
						Priority (1-10)
						<InfoPopover label="Priority" content="Higher priority places are favoured when route timing is tight. Use 10 for must-see places." />
					</span>
					<input bind:value={priority} class="field" inputmode="numeric" min="1" max="10" type="number" />
				</label>
				<label class="flex flex-col gap-1">
					<span class="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
						Earliest arrival (optional)
						<InfoPopover label="Earliest arrival" content="Do not arrive before this time. Useful for opening times or personal start preferences." />
					</span>
					<input bind:value={earliestArrival} class="field" type="time" />
				</label>
				<label class="flex flex-col gap-1">
					<span class="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
						Latest arrival (optional)
						<InfoPopover label="Latest arrival" content="Arrive by this time at the latest. The planner flags conflicts if arrival would be later." />
					</span>
					<input bind:value={latestArrival} class="field" type="time" />
				</label>
				<label class="flex flex-col gap-1 md:col-span-2">
					<span class="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
						Fixed arrival (optional, hard constraint)
						<InfoPopover label="Fixed arrival" content="Must arrive at exactly this time, such as booked tickets. This is treated as a strict constraint." />
					</span>
					<input bind:value={fixedArrival} class="field" type="time" />
				</label>
			</div>
			<button
				class="mt-4 inline-flex cursor-pointer rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-600"
				type="button"
				onclick={addPlace}
				disabled={!placeName.trim()}
			>
				Add place
			</button>
			{#if stopCount > 0}
				<a
					href="#stops-title"
					class="mt-2 inline-flex cursor-pointer rounded-lg bg-slate-100 px-4 py-2 font-medium text-slate-900 ring-1 ring-slate-300 hover:bg-slate-200"
				>
					Jump to stops ({stopCount})
				</a>
			{/if}
		</div>
	</div>
</section>

<style>
	.field {
		border: 1px solid #cbd5e1;
		border-radius: 0.5rem;
		padding: 0.6rem 0.75rem;
		background: #fff;
	}
	.field:focus {
		outline: 2px solid #0f766e;
		outline-offset: 1px;
	}
	.transport-option {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		border: 1px solid #cbd5e1;
		border-radius: 0.9rem;
		padding: 0.8rem 0.9rem;
		background: #ffffff;
		cursor: pointer;
		transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
	}
	.transport-option-active {
		border-color: #0f766e;
		box-shadow: inset 0 0 0 1px rgb(15 118 110 / 0.25);
		background: rgb(240 253 250 / 1);
	}
	.transport-option-disabled {
		cursor: default;
	}
	.transport-option:hover {
		border-color: #94a3b8;
	}
	.transport-icon {
		display: inline-flex;
		height: 2.1rem;
		width: 2.1rem;
		flex: 0 0 auto;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		background: rgb(241 245 249 / 1);
		color: #0f172a;
	}
</style>
