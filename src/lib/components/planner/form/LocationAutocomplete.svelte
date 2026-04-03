<script lang="ts">
  import { searchLondonLocations, type LocationSuggestion } from '$lib/services/geocode';

  let {
    label,
    value,
    placeholder,
    onSelect
  }: {
    label: string;
    value: string;
    placeholder: string;
    onSelect: (location: LocationSuggestion) => void;
  } = $props();

  const inputId = `location-autocomplete-${Math.random().toString(36).slice(2, 10)}`;
  const listboxId = `${inputId}-listbox`;
  const statusId = `${inputId}-status`;

  let query = $state('');
  let loading = $state(false);
  let suggestions = $state<LocationSuggestion[]>([]);
  let statusMessage = $state('');
  let highlightedIndex = $state(-1);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    query = value;
  });

  async function runSearch(nextQuery: string): Promise<void> {
    if (nextQuery.trim().length < 2) {
      suggestions = [];
      highlightedIndex = -1;
      statusMessage = 'Type at least 2 characters';
      return;
    }

    loading = true;
    statusMessage = 'Searching locations...';

    try {
      const results = await searchLondonLocations(nextQuery, 6);
      suggestions = results;
      highlightedIndex = results.length > 0 ? 0 : -1;
      statusMessage = results.length === 0 ? 'No matches found' : `${results.length} matches found`;
    } catch {
      suggestions = [];
      highlightedIndex = -1;
      statusMessage = 'Unable to fetch location suggestions right now';
    } finally {
      loading = false;
    }
  }

  function onInput(event: Event): void {
    const nextQuery = (event.currentTarget as HTMLInputElement).value;
    query = nextQuery;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      void runSearch(nextQuery);
    }, 250);
  }

  function chooseSuggestion(location: LocationSuggestion): void {
    query = location.label;
    suggestions = [];
    highlightedIndex = -1;
    statusMessage = `Selected ${location.label}`;
    onSelect(location);
  }

  function onSuggestionPointerDown(event: PointerEvent, location: LocationSuggestion): void {
    event.preventDefault();
    chooseSuggestion(location);
  }

  function onKeydown(event: KeyboardEvent): void {
    if (suggestions.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      highlightedIndex = (highlightedIndex + 1) % suggestions.length;
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      highlightedIndex = highlightedIndex <= 0 ? suggestions.length - 1 : highlightedIndex - 1;
      return;
    }

    if (event.key === 'Enter' && highlightedIndex >= 0) {
      event.preventDefault();
      const selected = suggestions[highlightedIndex];
      if (selected) {
        chooseSuggestion(selected);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      suggestions = [];
      highlightedIndex = -1;
      statusMessage = 'Suggestions closed';
    }
  }

  function onBlur(): void {
    setTimeout(() => {
      suggestions = [];
      highlightedIndex = -1;
    }, 120);
  }
</script>

<div class="flex flex-col gap-1">
  <label class="text-sm font-medium text-slate-700" for={inputId}>{label}</label>
  <input
    id={inputId}
    class="field"
    type="text"
    value={query}
    placeholder={placeholder}
    autocomplete="off"
    oninput={onInput}
    onkeydown={onKeydown}
    onblur={onBlur}
    role="combobox"
    aria-autocomplete="list"
    aria-controls={listboxId}
    aria-expanded={suggestions.length > 0}
    aria-activedescendant={highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined}
    aria-describedby={statusId}
  />

  {#if loading}
    <p class="text-xs text-slate-600" aria-live="polite">Searching...</p>
  {/if}

  {#if suggestions.length > 0}
    <ul id={listboxId} class="mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white" role="listbox">
      {#each suggestions as suggestion, index (suggestion.id)}
        <li id={`${listboxId}-option-${index}`} role="option" aria-selected={highlightedIndex === index}>
          <button
            type="button"
            class="w-full cursor-pointer border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
            class:bg-slate-100={highlightedIndex === index}
            onmouseenter={() => (highlightedIndex = index)}
            onpointerdown={(event) => onSuggestionPointerDown(event, suggestion)}
          >
            {suggestion.label}
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <p id={statusId} class="text-xs text-slate-500" aria-live="polite">{statusMessage}</p>
</div>

<style>
  .field {
    border: 1px solid #cbd5e1;
    border-radius: 0.5rem;
    padding: 0.6rem 0.75rem;
    background: #fff;
  }
  .field:focus {
    outline: 2px solid #152C4E;
    outline-offset: 1px;
  }
</style>
