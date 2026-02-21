/**
 * UI-related constants for consistent behavior across components
 */

/** Breakpoint (px) matching Tailwind's md breakpoint for mobile/desktop detection */
export const MOBILE_BREAKPOINT = 768;

/** Scroll distance (px) before UI elements collapse (scrolling down) */
export const SCROLL_COLLAPSE_THRESHOLD = 100;

/** Scroll distance (px) before UI elements expand (scrolling up) - creates hysteresis to prevent flicker */
export const SCROLL_EXPAND_THRESHOLD = 50;
