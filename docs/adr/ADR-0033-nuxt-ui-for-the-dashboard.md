# ADR-0033: The Dashboard Is Built With Nuxt UI

**Status:** Accepted

## Context

Epic 5 shipped the dashboard in Nuxt with no UI kit and no chart library (`specs/minimal-dashboard/spec.md`, *Further Notes*): about 1,100 lines of Vue and plain CSS. The owner found it hard to follow — English only, one long sheet — and, grilling epic 6 on 2026-09-26, chose to have it redesigned by an AI design tool and then built to that design (`specs/dashboard-design-and-languages/design-brief.md`).

## Decision

- The dashboard uses **Nuxt UI** (`@nuxt/ui`, version 4) for its components and theme. The designer is told to design with its components, so that the mockup maps onto them.
- Still **no chart library**: the weekly trend and the progress bars stay CSS or inline SVG.
- **No i18n module**: the English and Russian strings are a small dictionary of our own, with `Intl.PluralRules` for Russian plurals, and Nuxt UI's own locale for its components.

## Considered Options

- **Plain CSS on design tokens**, as today. Rejected by the owner: every component the mockup draws would be written and maintained by hand, and the port from the mockup is slower and less exact.
- **Tailwind alone.** Lighter, but it leaves the same components to write; Nuxt UI is Tailwind with them already built.

## Consequences

- The dashboard gains its first runtime dependencies, and Tailwind with them. It stays a static build the daemon serves (ADR-0031).
- **The page reaches nothing but the daemon.** Nuxt UI's icons and fonts must be bundled at build time: the icon collection installed locally, with no Iconify API call, and no font fetched from a remote provider. A page that loads anything from the network breaks that and fails review.
- Epic 5's decision "no UI kit" is superseded; its other decisions stand.
