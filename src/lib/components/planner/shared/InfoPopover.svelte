<script lang="ts">
  import { mdiInformationVariantCircleOutline } from '@mdi/js';
  import AppIcon from './AppIcon.svelte';

  let {
    label,
    content
  }: {
    label: string;
    content: string;
  } = $props();
</script>

<details class="info-popover">
  <summary aria-label={`More information about ${label}`} class="info-trigger">
    <AppIcon path={mdiInformationVariantCircleOutline} size={16} decorative={true} />
    <span class="sr-only">More information about {label}</span>
  </summary>
  <div class="info-content" role="note" aria-label={label}>{content}</div>
</details>

<style>
  .info-popover {
    position: relative;
    display: inline-block;
  }

  .info-trigger {
    list-style: none;
    width: 1.25rem;
    height: 1.25rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #334155;
    cursor: pointer;
    line-height: 0;
  }

  .info-trigger:hover {
    color: #152C4E;
  }

  .info-trigger:focus-visible {
    outline: 2px solid #152C4E;
    outline-offset: 2px;
    border-radius: 999px;
  }

  .info-trigger::-webkit-details-marker {
    display: none;
  }

  .info-content {
    position: absolute;
    z-index: 20;
    top: 1.6rem;
    left: 0;
    width: min(18rem, 80vw);
    border: 1px solid #cbd5e1;
    border-radius: 0.75rem;
    background: #ffffff;
    color: #1e293b;
    padding: 0.6rem 0.75rem;
    font-size: 0.8rem;
    line-height: 1.35;
    box-shadow: 0 10px 25px rgb(15 23 42 / 0.12);
  }

  @media (max-width: 640px) {
  .info-content {
    left: auto;
    right: 0;
    width: min(18rem, calc(100vw - 2rem));
  }
  }
</style>
