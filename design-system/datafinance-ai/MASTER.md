# Design System Master File — DataFinance AI

> **LOGIC:** Centralized SaaS Design System following Minimalism & Swiss Style inspired by Stripe, Linear, Ramp, and Mercury.

---

**Project:** DataFinance AI (*Distribuidora del Caribe S.A.S.* — Barranquilla, COP)
**Updated:** 2026-11-12
**Stack:** `React 18 + Tailwind CSS v4 + Plotly.js + Lucide React + React Markdown`
**Design Dials:** Minimalist SaaS Clarity | Motion `3/10` (Subtle) | Functional Hierarchy

---

## 1. Visual Identity & Semantic Tokens

| Role | Hex | Token | Functional Usage |
|---|---|---|---|
| Background | `#F8FAFC` | `--color-background` | App canvas |
| Card / Surface | `#FFFFFF` | `--color-card` | Primary containers, sidebar, header |
| Subtle Surface | `#F1F5F9` | `--color-muted` | Hover backgrounds, table headers, prompt chips |
| Primary Blue | `#2563EB` | `--color-primary` | Primary CTAs, active indicators, focus rings |
| Deep Navy | `#172554` | `--color-navy` | Brand mark, executive emphasis |
| Primary Text | `#0F172A` | `--color-ink` | Headings, KPI figures, body text |
| Secondary Text | `#64748B` | `--color-muted-foreground` | Captions, axis ticks, helper labels |
| Hairline Border | `#E2E8F0` | `--color-border` | Card borders, table dividers, inputs |
| Positive Green | `#059669` | `--color-positive` | Income, profit gains, healthy connection |
| Negative Red | `#DC2626` | `--color-destructive` | Expenses, profit drops, critical severity |
| Warning Orange | `#D97706` | `--color-accent` | Warnings, statistical alerts, partial periods |

---

## 2. Typography Scale (`Inter` + `JetBrains Mono`)

- **UI & Numerical Font:** `Inter` (`font-sans`) with `tabular-nums` on every financial figure, table cell, and percentage delta.
- **Technical / SQL Font:** `JetBrains Mono` (`font-mono`) strictly for executed SQL trace blocks and technical identifiers.
- **Scale:**
  - View title (`h1`): `22–24px` (`font-semibold tracking-tight`)
  - Section title (`h2`): `16–18px` (`font-semibold`)
  - Body text: `14–15px`
  - Secondary metadata & table headers: `12–13px`

---

## 3. Centralized Reusable UI Primitives (`frontend/src/components/ui/`)

- `Card.jsx`: Crisp `#FFFFFF` containers with `1px` `#E2E8F0` borders (`rounded-xl`), zero decorative shadow clutter.
- `Button.jsx`: Unified `primary`, `secondary`, and `ghost` variants with explicit hover, focus-visible ring, disabled state, and `cursor-pointer`.
- `Badge.jsx`: Static-mapped semantic pills (`neutral`, `primary`, `positive`, `negative`, `warning`, `ai`) distinguishing SQL metrics, statistical alerts, and AI prose.
- `Tooltip.jsx`: Accessible hover/focus explanation popover without crowding KPI cards.
- `AlertBanner.jsx` & `EmptyState.jsx`: `role="alert"` error banners and helpful action-oriented empty states.

---

## 4. Module Architecture & UX Rules

1. **Collapsible Sidebar + Sticky Compact Topbar:** Light `#FFFFFF` collapsible sidebar (`240px` expanded / `68px` collapsed on desktop; slide-over drawer on mobile), separating navigation from quiet service connection indicators.
2. **Resumen Financiero:** Compact top filters (`h-9`), 4-card KPI strip showing period-over-period MoM comparisons **only when >= 2 periods of real data exist**, full-width Monthly Evolution chart + balanced Category/Area split, verified monthly table (`overflow-x-auto`), and low-noise Medallion audit strip.
3. **Agente Analista:** Conversational prompt workspace + structured response cards separating: Question -> AI Executive Summary (`MarkdownRenderer`) -> Returned Data Table -> Unobtrusive collapsible SQL Trace + Traceability metadata.
4. **Anomalías & Reportes Ejecutivos:** Consistent severity classification (`Crítica` vs `Advertencia`), executive KPI summary context, clean formatted reports, and copy-to-clipboard action.
