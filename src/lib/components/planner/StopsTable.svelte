<script lang="ts">
	import InfoPopover from './InfoPopover.svelte';
	import type { Place } from '$lib/types/planner';

	let {
		places,
		onUpdate,
		onRemove
	}: {
		places: Place[];
		onUpdate: (place: Place) => void;
		onRemove: (id: string) => void;
	} = $props();

	function updateText(place: Place, key: 'name' | 'earliestArrival' | 'latestArrival' | 'fixedArrival', value: string): void {
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

	function readInputValue(event: Event): string {
		return (event.currentTarget as HTMLInputElement).value;
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
		<div class="mt-4 grid gap-4 lg:grid-cols-2">
			{#each places as place, index (place.id)}
				<article class="rounded-xl border border-slate-200 bg-slate-50/60" aria-labelledby={`stop-${place.id}-title`}>
					<div class="px-4 py-3">
						<div class="min-w-0">
							<h3
								id={`stop-${place.id}-title`}
								class="truncate text-base font-semibold text-slate-900"
								title={place.name || `Stop ${index + 1}`}
							>
								{place.name || `Stop ${index + 1}`}
							</h3>
							<p class="text-xs text-slate-600">Stop {index + 1} • Dwell {place.constraint.minimumDwellMinutes} min • Priority {place.constraint.priority}</p>
						</div>
					</div>

					<div class="border-t border-slate-200 px-4 py-4">
						<div class="mt-3 grid gap-3 md:grid-cols-2">
						<label class="flex flex-col gap-1 md:col-span-2">
							<span class="text-sm font-medium text-slate-700">Place name</span>
							<input class="field" type="text" value={place.name} onchange={(event) => updateText(place, 'name', readInputValue(event))} />
						</label>

						<label class="flex flex-col gap-1">
							<span class="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
								Minimum dwell time (minutes)
								<InfoPopover label="Minimum dwell time" content="The least time you want to spend at this stop." />
							</span>
							<input class="field" type="number" min="5" step="5" value={place.constraint.minimumDwellMinutes} onchange={(event) => updateNumber(place, 'minimumDwellMinutes', readInputValue(event))} />
						</label>

						<label class="flex flex-col gap-1">
							<span class="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
								Priority (1-10)
								<InfoPopover label="Priority" content="Higher priority stops are favoured when timings become tight." />
							</span>
							<input class="field" type="number" min="1" max="10" value={place.constraint.priority} onchange={(event) => updateNumber(place, 'priority', readInputValue(event))} />
						</label>

						<label class="flex flex-col gap-1">
							<span class="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
								Earliest arrival
								<InfoPopover label="Earliest arrival" content="Do not arrive before this time." />
							</span>
							<input class="field" type="time" value={place.constraint.earliestArrival ?? ''} onchange={(event) => updateText(place, 'earliestArrival', readInputValue(event))} />
						</label>

						<label class="flex flex-col gap-1">
							<span class="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
								Latest arrival
								<InfoPopover label="Latest arrival" content="You should arrive by this time at the latest." />
							</span>
							<input class="field" type="time" value={place.constraint.latestArrival ?? ''} onchange={(event) => updateText(place, 'latestArrival', readInputValue(event))} />
						</label>

						<label class="flex flex-col gap-1 md:col-span-2">
							<span class="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
								Fixed arrival time
								<InfoPopover label="Fixed arrival" content="A strict arrival time, such as ticket entry or a booking." />
							</span>
							<input class="field" type="time" value={place.constraint.fixedArrival ?? ''} onchange={(event) => updateText(place, 'fixedArrival', readInputValue(event))} />
						</label>
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
