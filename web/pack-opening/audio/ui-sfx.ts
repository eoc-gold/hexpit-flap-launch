// Menu / chrome UI sound action (AAA-push G9). One Svelte action that gives any
// button (or other element) a click "thunk" and an optional soft hover rollover,
// so the whole hub/menu layer feels alive without hand-wiring playSfx() into
// every onclick. Pure presentation; the SFX pool is already gesture-armed by
// setupSfx().
//
//   <button use:uiSfx>            -> click 'card-pick', hover 'hover'
//   <button use:uiSfx={'ready'}>  -> click 'ready', hover 'hover'
//   <button use:uiSfx={{ click: 'ready', hover: false }}> -> click only
//
// A disabled element never fires (we read .disabled / aria-disabled at event
// time), so muted "coming soon" tabs stay silent.
import { playSfx, type SfxName } from './sfx';

type UiSfxOpts = SfxName | { click?: SfxName; hover?: SfxName | false };

const DEFAULT_CLICK: SfxName = 'card-pick';
const DEFAULT_HOVER: SfxName | false = 'hover';

function resolve(opts: UiSfxOpts): { click: SfxName; hover: SfxName | false } {
  if (typeof opts === 'string') return { click: opts, hover: DEFAULT_HOVER };
  return {
    click: opts.click ?? DEFAULT_CLICK,
    hover: opts.hover === undefined ? DEFAULT_HOVER : opts.hover
  };
}

function isDisabled(node: HTMLElement): boolean {
  return (
    (node as HTMLButtonElement).disabled === true ||
    node.getAttribute('aria-disabled') === 'true'
  );
}

export function uiSfx(node: HTMLElement, opts: UiSfxOpts = {}) {
  let cfg = resolve(opts);
  const onEnter = () => {
    if (cfg.hover && !isDisabled(node)) playSfx(cfg.hover);
  };
  const onClick = () => {
    if (!isDisabled(node)) playSfx(cfg.click);
  };
  node.addEventListener('pointerenter', onEnter);
  node.addEventListener('click', onClick);
  return {
    update(next: UiSfxOpts = {}) {
      cfg = resolve(next);
    },
    destroy() {
      node.removeEventListener('pointerenter', onEnter);
      node.removeEventListener('click', onClick);
    }
  };
}
