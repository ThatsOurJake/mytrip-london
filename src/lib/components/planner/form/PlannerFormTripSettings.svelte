<script lang="ts">
	import type { LocationSuggestion } from '$lib/services/geocode';
	import type { RouteDataSource, TransportPreference } from '$lib/types/planner';
	import type { ActiveTravelOption, DataSourceOption, TransitOption } from './planner-form-types';
	import AppIcon from '../shared/AppIcon.svelte';
	import LocationAutocomplete from './LocationAutocomplete.svelte';
	import './planner-form-shared.css';

	let {
		hotelSearchQuery,
		hotelName,
		hotelLat,
		hotelLng,
		activeTravelOptions,
		transitOptions,
		dataSourceOptions,
		hasPreference,
		togglePreference,
		selectionSummary,
		dataSource,
		dataSourceNotice,
		onHotelNameChange,
		onHotelLatChange,
		onHotelLngChange,
		onHotelSuggestionSelect,
		onDataSourceChange
	}: {
		hotelSearchQuery: string;
		hotelName: string;
		hotelLat: string;
		hotelLng: string;
		activeTravelOptions: ActiveTravelOption[];
		transitOptions: TransitOption[];
		dataSourceOptions: DataSourceOption[];
		hasPreference: (preference: TransportPreference) => boolean;
		togglePreference: (preference: TransportPreference) => void;
		selectionSummary: () => string;
		dataSource: RouteDataSource;
		dataSourceNotice: () => string;
		onHotelNameChange: (value: string) => void;
		onHotelLatChange: (value: string) => void;
		onHotelLngChange: (value: string) => void;
		onHotelSuggestionSelect: (location: LocationSuggestion) => void;
		onDataSourceChange: (value: RouteDataSource) => void;
	} = $props();
</script>

<div class="rounded-2xl border border-slate-300 bg-white/90 p-5 shadow-sm">
	<h2 id="planner-config-title" class="text-xl font-semibold text-slate-900">Trip settings</h2>
	<p class="mt-1 text-sm text-slate-700">These settings define the base for optimisation: your hotel, travel style, route source, and one or more trip days.</p>

	<div class="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
		<div class="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
			<h3 class="text-base font-semibold text-slate-900">Start point and trip details</h3>
			<div class="mt-3 space-y-3">
				<LocationAutocomplete label="Hotel search (London)" value={hotelSearchQuery} placeholder="Search for your hotel" onSelect={onHotelSuggestionSelect} />
				<label class="flex flex-col gap-1">
					<span class="text-sm font-medium text-slate-700">Hotel display name</span>
					<input class="field" type="text" placeholder="The Savoy" value={hotelName} oninput={(event) => onHotelNameChange((event.currentTarget as HTMLInputElement).value)} />
				</label>
				<div class="grid gap-3 sm:grid-cols-2">
					<label class="flex flex-col gap-1">
						<span class="text-sm font-medium text-slate-700">Hotel latitude</span>
						<input class="field" inputmode="decimal" type="text" value={hotelLat} oninput={(event) => onHotelLatChange((event.currentTarget as HTMLInputElement).value)} />
					</label>
					<label class="flex flex-col gap-1">
						<span class="text-sm font-medium text-slate-700">Hotel longitude</span>
						<input class="field" inputmode="decimal" type="text" value={hotelLng} oninput={(event) => onHotelLngChange((event.currentTarget as HTMLInputElement).value)} />
					</label>
				</div>
			</div>
		</div>

		<div class="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
			<h3 class="text-base font-semibold text-slate-900">Transport and routing</h3>
			<p class="mt-1 text-sm text-slate-700">Set travel modes and route source.</p>
			<fieldset class="mt-3 space-y-2">
				<legend class="text-sm font-medium text-slate-700">Transport preferences</legend>
				<p class="text-sm text-slate-600">Walking stays enabled. Add cycling or any TfL services you want available.</p>
				<div class="space-y-2.5">
					<div>
						<p class="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Active travel</p>
						<div class="grid gap-2 sm:grid-cols-2">
							{#each activeTravelOptions as option}
								<label class={`transport-option transport-option-compact ${hasPreference(option.preference) ? 'transport-option-active' : ''} ${option.disabled ? 'transport-option-disabled' : ''}`} title={option.description}>
									<input class="sr-only" type="checkbox" checked={hasPreference(option.preference)} disabled={option.disabled} onchange={() => togglePreference(option.preference)} />
									<span class="transport-icon transport-icon-compact"><AppIcon path={option.icon} size={16} label={option.label} /></span>
									<span class="min-w-0"><span class="block font-medium leading-tight text-slate-900">{option.label}</span><span class="block text-[11px] leading-tight text-slate-600">{option.description}</span></span>
								</label>
							{/each}
						</div>
					</div>
					<div>
						<p class="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">TfL services</p>
						<div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-2">
							{#each transitOptions as option}
								<label class={`transport-option transport-option-compact ${hasPreference(option.preference) ? 'transport-option-active' : ''}`} title={option.description}>
									<input class="sr-only" type="checkbox" checked={hasPreference(option.preference)} onchange={() => togglePreference(option.preference)} />
									<span class="transport-icon transport-icon-compact"><AppIcon path={option.icon} size={16} label={option.label} /></span>
									<span class="min-w-0"><span class="block font-medium leading-tight text-slate-900">{option.label}</span><span class="block text-[11px] leading-tight text-slate-600">{option.description}</span></span>
								</label>
							{/each}
						</div>
					</div>
				</div>
				<p class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{selectionSummary()}</p>
			</fieldset>
			<fieldset class="mt-3 space-y-2">
				<legend class="text-sm font-medium text-slate-700">Route data source</legend>
				<p class="text-sm text-slate-600">Choose the routing source.</p>
				<div class="grid gap-2 sm:grid-cols-2">
					{#each dataSourceOptions as option}
						<label class={`transport-option transport-option-compact transport-option-text-only ${dataSource === option.value ? 'transport-option-active' : ''}`} title={option.description}>
							<input class="sr-only" type="radio" name="route-data-source" value={option.value} checked={dataSource === option.value} onchange={() => onDataSourceChange(option.value)} />
							<span class="min-w-0"><span class="block font-medium leading-tight text-slate-900">{option.label}</span><span class="block text-[11px] leading-tight text-slate-600">{option.description}</span></span>
						</label>
					{/each}
				</div>
				<p class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{dataSourceNotice()}</p>
			</fieldset>
		</div>
	</div>
</div>
