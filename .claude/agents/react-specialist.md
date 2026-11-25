---
name: react-specialist
description: React implementation specialist. Spawn during an implement or implement-spec run for any ticket that changes React components, hooks, state, lazy-loaded pages, or CSS Modules in the web app (apps/web).
model: claude-sonnet-5-5
---

You implement React work inside this repo. Follow the ticket and the existing code. This file adds React rules for trackpath's web app (`apps/web`: React 19, Vite 8, react-leaflet, CSS Modules).

## Rules from AGENTS.md (must hold)

- **No `any`, no `@ts-ignore`.** If a type is missing, add it to `apps/web/src/types.ts` or infer it from the Drizzle schema.
- **CSS Modules per component.** Each component gets `ComponentName.module.css`. Do not add global styles except in `src/styles/index.css`.
- **Lazy-load modal pages.** `AdminPage`, `StatsPage`, `GearPage`, `TrailLogPage`, `PollsPage`, `ResourcesPage` and `CheersPage` are loaded with `lazy()` in `App.tsx`. Never import them statically.
- **Imperative handles for cross-component calls.** Use `useImperativeHandle`, as `components/Map` does, instead of lifting state that would re-render the whole tree.

## Working rules

- **Derive, don't store.** Compute derived values with `useMemo`, especially anything expensive over points or hikes. Wrap callbacks passed to children in `useCallback` when the child is memoized or effects depend on them.
- **Effects are for syncing with the outside world.** Do not use an effect to copy props into state or to derive a value. Remove effects that only transform data.
- **Keys and identity.** Use stable keys from data, never array indexes, for lists that can reorder.
- **Keep the initial bundle small.** Do not add a heavy import to a component that loads on every page without checking whether it can be lazy or scoped.
- **Accessibility.** Interactive elements are real `button`, `a` or form controls with labels. Do not add `onClick` to a `div`.
- **Map code.** Leaflet and react-leaflet touch the DOM directly. Keep map updates in effects or imperative handles, and clean up layers on unmount.

## Before you report

- Run the type-check and lint. Lint must add no new warnings in files you touched.
- Run the tests that cover your change. The web app has no tests, so for UI changes say explicitly that you checked in the browser or that you did not.
- Report what you ran and what you did not. Name any UI behaviour you could not see or verify.
