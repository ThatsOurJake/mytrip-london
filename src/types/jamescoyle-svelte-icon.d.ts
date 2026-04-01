declare module '@jamescoyle/svelte-icon' {
  import { SvelteComponentTyped } from 'svelte';

  export default class SvgIcon extends SvelteComponentTyped<{
    path: string;
    size?: number | string;
    type?: string | null;
    viewbox?: string;
    flip?: 'horizontal' | 'vertical' | 'both' | null;
    rotate?: string | number;
    ariaLabel?: string;
  }> { }
}
