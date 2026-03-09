import { h } from '@stencil/core';

/**
 * Map from signal-type key to the corresponding SVG icon JSX.
 *
 * Keys follow the pattern:  `[prefix-]typeName`
 *   - no prefix   – default icon for that type
 *   - `bus-`      – multi-bit (size > 1) variant
 *   - `clk-`      – clock variant (name contains "clk")
 */
export const SIGNAL_ICONS: Record<string, any> = {
  module:        <svg class="icon icon-module"><use xlinkHref="#icon_browser_module" /></svg>,
  wire:          <svg class="icon icon-wire"><use xlinkHref="#icon_signal_wire" /></svg>,
  integer:       <svg class="icon icon-wire"><use xlinkHref="#icon_signal_integer" /></svg>,
  logic:         <svg class="icon icon-wire"><use xlinkHref="#icon_signal_wire" /></svg>,
  bit:           <svg class="icon icon-wire"><use xlinkHref="#icon_signal_wire" /></svg>,
  event:         <svg class="icon icon-event"><use xlinkHref="#icon_event" /></svg>,
  parameter:     <svg class="icon icon-parameter"><use xlinkHref="#icon_parameter" /></svg>,
  real:          <svg class="icon icon-real"><use xlinkHref="#icon_signal_real" /></svg>,
  reg:           <svg class="icon icon-reg"><use xlinkHref="#icon_signal_reg" /></svg>,
  bus:           <svg class="icon icon-bus"><use xlinkHref="#icon_signal_bus" /></svg>,
  'bus-wire':    <svg class="icon icon-bus"><use xlinkHref="#icon_signal_bus" /></svg>,
  'bus-integer': <svg class="icon icon-bus"><use xlinkHref="#icon_signal_integer" /></svg>,
  'bus-real':    <svg class="icon icon-real"><use xlinkHref="#icon_signal_real" /></svg>,
  'bus-parameter':<svg class="icon icon-parameter"><use xlinkHref="#icon_parameter" /></svg>,
  'bus-logic':   <svg class="icon icon-bus"><use xlinkHref="#icon_signal_bus" /></svg>,
  'bus-bit':     <svg class="icon icon-bus"><use xlinkHref="#icon_signal_bus" /></svg>,
  'bus-reg':     <svg class="icon icon-bus"><use xlinkHref="#icon_signal_bus_reg" /></svg>,
  'clk-reg':     <svg class="icon icon-clk"><use xlinkHref="#icon_signal_clk" /></svg>,
  'clk-wire':    <svg class="icon icon-clk"><use xlinkHref="#icon_signal_clk" /></svg>,
  'clk-integer': <svg class="icon icon-clk"><use xlinkHref="#icon_signal_integer" /></svg>,
  'clk-logic':   <svg class="icon icon-clk"><use xlinkHref="#icon_signal_clk" /></svg>,
  'clk-bit':     <svg class="icon icon-clk"><use xlinkHref="#icon_signal_clk" /></svg>,
  'clk-real':    <svg class="icon icon-real"><use xlinkHref="#icon_signal_clk" /></svg>,
  'clk-event':   <svg class="icon icon-event"><use xlinkHref="#icon_event" /></svg>,
  'clk-parameter':<svg class="icon icon-parameter"><use xlinkHref="#icon_parameter" /></svg>,
  'machine-pc':  <svg class="icon icon-wire"><use xlinkHref="#icon_signal_wire" /></svg>,
};

/**
 * Determine the icon key for a given signal.
 */
export function getSignalIconKey(name: string, type: string, size: number): string {
  let prefix = '';
  if (name.includes('clk')) {
    prefix = 'clk-';
  } else if (size > 1) {
    prefix = 'bus-';
  }
  return prefix + type;
}
