<script lang="ts">
	import { getDayPalette } from '$lib/services/planner/day-colors';
	import { VISIT_TIME_FIELD_LABEL, VISIT_TIME_STOP_INFO, visitTimeSummary } from '$lib/services/planner/ui-text';
	import FieldLabel from './FieldLabel.svelte';
	import InfoPopover from './InfoPopover.svelte';
	import type { Place, TripPlanningDay } from '$lib/types/planner';

	let {
		places,
		planningDays,
		onUpdate,
		onRemove
	}: {
		places: Place[];
		planningDays: TripPlanningDay[];
		onUpdate: (place: Place) => void;
		onRemove: (id: string) => void;
	} = $props();

	function updateText(place: Place, key: 'name' | 'openingTime' | 'closingTime' | 'fixedArrival', value: string): void {
		if (key === 'name') {
			onUpdate({ ...place, name: value });
			return;
		}

		onUpdate({
			...place,
			constraint: {
				...place.constraint,
				[key]: value || undefined
			}
		});
	}

	function updateNumber(place: Place, key: 'minimumDwellMinutes' | 'priority', value: string): void {
		onUpdate({
			...place,
			constraint: {
				...place.constraint,
				[key]: Number(value)
			}
		});
	}

	function updatePreferredDay(place: Place, preferredDayId: string): void {
		onUpdate({
			...place,
			constraint: {
				...place.constraint,
				preferredDayId: preferredDayId || undefined
			}
		});
	}

	function readInputValue(event: Event): string {
		return (event.currentTarget as HTMLInputElement | HTMLSelectElement).value;
	}

	function preferredDaySummary(place: Place): string {
		if (planningDays.length <= 1) {
			return 'Single trip day';
		}

		const preferredDay = planningDays.find((day) => day.id === place.constraint.preferredDayId);
		return preferredDay ? `Prefers ${preferredDay.label}` : 'Flexible day';
	}

	function preferredDayCardStyle(place: Place): string {
		const preferredDay = planningDays.find((day) => day.id === place.constraint.preferredDayId);
		if (!preferredDay) {
			return '';
		}

		const palette = getDayPalette(preferredDay.palette);
		return `background:${palette.surface};border-color:${palette.border};`;
	}

	function preferredDaySummaryStyle(place: Place): string {
		const preferredDay = planningDays.find((day) => day.id === place.constraint.preferredDayId);
		if (!preferredDay) {
			return '';
		}

		const palette = getDayPalette(preferredDay.palette);
		return `color:${palette.text};`;
	}

	let pendingRemovalId = $state<string | null>(null);

	function requestRemove(id: string): void {
		pendingRemovalId = id;
	}

	function cancelRemove(): void {
		pendingRemovalId = null;
	}

	function confirmRemove(id: string): void {
		onRemove(id);
		pendingRemovalId = null;
	}
</script>

<section aria-labelledby="stops-title" class="rounded-2xl border border-slate-300 bg-white/90 p-5 shadow-sm">
	<h2 id="stops-title" class="text-xl font-semibold text-slate-900">Stops</h2>
	<p class="mt-1 text-sm text-slate-700">Edit each stop directly below. No horizontal scrolling needed.</p>

	{#if places.length === 0}
		<p class="mt-3 text-sm text-slate-600">No places added yet.</p>
	{:else}
		<div class="mt-4 grid gap-4 xl:grid-cols-2">
			{#each places as place, index (place.id)}
				<article class="rounded-xl border border-slate-200 bg-slate-50/60" style={preferredDayCardStyle(place)} aria-labelledby={`stop-${place.id}-title`}>
					<div class="px-4 py-3">
						<div class="min-w-0">
							<h3
								id={`stop-${place.id}-title`}
								class="truncate text-base font-semibold text-slate-900"
								title={place.name || `Stop ${index + 1}`}
							>
								{place.name || `Stop ${index + 1}`}
							</h3>
							<p class="flex flex-wrap items-center text-xs text-slate-600" style={preferredDaySummaryStyle(place)}>
								<span>{visitTimeSummary(place.constraint.minimumDwellMinutes)}</span>
								<span class="mx-1.5 text-current/60" aria-hidden="true">•</span>
								<span>Priority {place.constraint.priority}</span>
								{#if planningDays.length > 1}
									<span class="mx-1.5 text-current/60" aria-hidden="true">•</span>
									<span>{preferredDaySummary(place)}</span>
								{/if}
							</p>
						</div>
					</div>

					<div class="border-t border-slate-200 px-4 py-4">
						<div class="grid gap-3 md:grid-cols-2">
						<label class="flex flex-col gap-1 md:col-span-2">
							<span class="text-sm font-medium text-slate-700">Place name</span>
							<input class="field" type="text" value={place.name} onchange={(event) => updateText(place, 'name', readInputValue(event))} />
						</label>

						<label class="flex flex-col gap-1">
							<FieldLabel text={VISIT_TIME_FIELD_LABEL} infoLabel={VISIT_TIME_FIELD_LABEL} infoContent={VISIT_TIME_STOP_INFO} />
							<input class="field" type="number" min="5" step="5" value={place.constraint.minimumDwellMinutes} onchange={(event) => updateNumber(place, 'minimumDwellMinutes', readInputValue(event))} />
						</label>

						<label class="flex flex-col gap-1">
							<FieldLabel text="Priority (1-10)" infoLabel="Priority" infoContent="Higher priority stops are favoured when timings become tight." />
							<input class="field" type="number" min="1" max="10" value={place.constraint.priority} onchange={(event) => updateNumber(place, 'priority', readInputValue(event))} />
						</label>

						<label class="flex flex-col gap-1">
							<FieldLabel text="Opening time" infoLabel="Opening time" infoContent="The planner will not schedule this stop before it opens." />
							<input class="field" type="time" value={place.constraint.openingTime ?? ''} onchange={(event) => updateText(place, 'openingTime', readInputValue(event))} />
						</label>

						<label class="flex flex-col gap-1">
							<FieldLabel text="Closing time" infoLabel="Closing time" infoContent="The planner aims to finish the visit before this time." />
							<input class="field" type="time" value={place.constraint.closingTime ?? ''} onchange={(event) => updateText(place, 'closingTime', readInputValue(event))} />
						</label>

						<label class="flex flex-col gap-1 md:col-span-2">
							<FieldLabel text="Fixed arrival time" infoLabel="Fixed arrival" infoContent="A strict arrival time, such as ticket entry or a booking." />
							<input class="field" type="time" value={place.constraint.fixedArrival ?? ''} onchange={(event) => updateText(place, 'fixedArrival', readInputValue(event))} />
						</label>

						{#if planningDays.length > 1}
							<label class="flex flex-col gap-1 md:col-span-2">
								<FieldLabel text="Preferred trip day" infoLabel="Preferred trip day" infoContent="Optional. Keep this stop flexible, or ask the planner to try a specific trip day first." />
								<select class="field" value={place.constraint.preferredDayId ?? ''} onchange={(event) => updatePreferredDay(place, readInputValue(event))}>
									<option value="">Flexible across days</option>
									{#each planningDays as day}
										<option value={day.id}>{day.label}{#if day.date} • {day.date}{/if}</option>
									{/each}
								</select>
								<span class="text-xs text-slate-500">The planner will try to keep this stop on the selected day before using later days.</span>
							</label>
						{/if}
							</div>

						<div class="mt-4 border-t border-slate-200 pt-3">
							{#if pendingRemovalId === place.id}
								<div class="flex flex-wrap items-center justify-end gap-2" role="status" aria-live="polite">
									<span class="text-sm text-rose-800">Remove this stop?</span>
									<button class="cursor-pointer rounded-md bg-slate-200 px-3 py-1 text-sm font-medium text-slate-900 hover:bg-slate-300" type="button" onclick={cancelRemove}>
										Cancel
									</button>
									<button
										class="cursor-pointer rounded-md bg-rose-700 px-3 py-1 text-sm font-medium text-white hover:bg-rose-600"
										type="button"
										onclick={() => confirmRemove(place.id)}
									>
										Yes, remove
									</button>
								</div>
							{:else}
								<div class="flex justify-end">
									<button
										class="cursor-pointer rounded-md bg-rose-700 px-3 py-1 text-sm font-medium text-white hover:bg-rose-600"
										type="button"
										onclick={() => requestRemove(place.id)}
									>
										Remove stop
									</button>
								</div>
							{/if}
						</div>
						</div>
				</article>
			{/each}
		</div>
	{/if}
</section>

<style>
	.field {
		width: 100%;
		border: 1px solid #cbd5e1;
		border-radius: 0.5rem;
		padding: 0.4rem 0.6rem;
		background: #fff;
	}
	.field:focus {
		outline: 2px solid #0f766e;
		outline-offset: 1px;
	}
</style>
