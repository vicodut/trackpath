/**
 * AT Tracker — Tactical Cartographer Design System
 * Forest palette + orange accent
 *
 * Single source of truth for colors, fonts, and design tokens.
 * CSS variables in styles/index.css reference these same values.
 * Use this file when colors are needed in JS/TS (e.g. Leaflet icons).
 */

export const colors = {
  surface: '#0b160d',
  surfaceContainerLowest: '#061108',
  surfaceContainerLow: '#131e15',
  surfaceContainer: '#172219',
  surfaceContainerHigh: '#212d23',
  surfaceContainerHighest: '#2c382d',
  surfaceBright: '#303c32',

  primary: '#b8ccb8',
  primaryContainer: '#1b2b1e',

  secondary: '#fe6b00',
  secondaryDim: '#ffb693',
  onSecondary: '#561f00',

  onSurface: '#d9e6d7',
  onSurfaceVariant: '#c3c8c0',

  outline: '#8d928b',
  outlineVariant: '#434843',

  tertiary: '#c7c6c6',

  error: '#ffb4ab',
  errorContainer: '#93000a',

  // Trail
  trail: '#8B5E3C',
  trailHighlight: '#c8a2f8',

  // Strava-specific
  strava: '#ff8c00',
} as const;

export const fonts = {
  headline: "'Space Grotesk', sans-serif",
  body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
} as const;

export const breakpoints = {
  mobile: 768,
} as const;
