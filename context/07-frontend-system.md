# 07-frontend-system.md - Frontend System & UI Rules

This is the Single Source of Truth (SSOT) for LeadFlow's frontend architecture, design system, component patterns, and UX rules.

---

## 1. Frontend Architecture
The LeadFlow frontend is built using the following stack:
- **Framework:** Next.js 15 (App Router, React Server Components)
- **Language:** TypeScript (strict mode enabled)
- **Styling:** Tailwind CSS (utility-first, leveraging design tokens)
- **Component Library:** shadcn/ui (radix-ui primitives)
- **State Management:** React Context (for UI state) and TanStack Query / SWR (for server state caching)

---

## 2. Design Principles
- **Clean & High-Contrast:** Focus on maximum readability of data. High-contrast typography and clear visual hierarchy.
- **Professional & Aesthetic:** Minimal ornamentation. Rely on elegant geometry, consistent spacing, and subtle border borders instead of heavy gradients.
- **Dashboard-First:** The primary interface is a split panel focused on displaying metrics, leads lists, and status updates.
- **Data-Focused:** Priority is given to information density. Tables, metrics, and logs should occupy main viewport real estate.
- **Minimal Animations:** Only use animations for critical micro-interactions (e.g., hover transitions, modal fade-ins, loading spinners). Keep duration under `150ms`.

---

## 3. Color Rules & Design Tokens
All styling must use Tailwind design tokens referencing the theme. **Never hardcode hex/rgb colors.**

### Primary Palette
- **Primary (Blue):** `bg-blue-600` / `text-blue-600` (Hover: `bg-blue-700`)
- **Background:** `bg-slate-50` (App background), `bg-white` (Cards, Panels)
- **Borders / Separators:** `border-slate-200`
- **Text:** `text-slate-900` (Headers, Primary), `text-slate-500` (Muted, Labels)

### Semantic Colors
- **Success (Green):** `bg-emerald-500` / `text-emerald-700` (for Converted leads and met SLAs)
- **Warning (Amber):** `bg-amber-500` / `text-amber-700` (for Near-breach SLAs and duplicate warnings)
- **Error (Red):** `bg-rose-500` / `text-rose-700` (for SLA violations, errors, and rejections)

---

## 4. Layout Rules
The application layout follows a unified triple-zone structure:
- **Sidebar Navigation:** Sticky left navigation panel (width: `260px`). Contains links to Dashboard, Leads, Agents, Reports, and System Settings.
- **Top Header:** Persistent bar (height: `64px`) displaying current route title, system status alerts, agent toggle switch (Active/Inactive), and user profile dropdown.
- **Main Content Area:** Scrollable viewport.
  - **Maximum Content Width:** `1400px` (`max-w-7xl` or custom `max-w-[1400px]`)
  - **Centering:** Must be horizontally centered (`mx-auto`) with responsive padding (`px-4 sm:px-6 lg:px-8 py-6`).

---

## 5. Dashboard Components
Only the following approved component patterns are allowed in LeadFlow dashboards:
- **KPI Cards:** Small panels showing key metrics (e.g., Active Leads, Conversion Rate, SLA Adherence) with a clear header, large value, and delta indicator.
- **Data Tables:** Relational tabular data displaying lists of leads or agents.
- **Charts:** Visual trends (e.g., line charts for lead ingestion velocity, bar charts for agent lead counts) utilizing `recharts` wrapped in shadcn style container.
- **Filters:** Top-bar controls for Date Range, Priority Tier, Lead Source, and Assigned Agent.
- **Modals (Dialogs):** Overlay popups for configuration, editing agents, or manual reassignments.
- **Toast Notifications:** Low-intrusion popups in the bottom-right corner for background operations, success, and errors.

---

## 6. Table Rules
All tables displaying core records must support:
- **Sorting:** Interactive table headers with chevron indicators displaying current sort direction.
- **Pagination:** Bottom-bar controls displaying current range (e.g., "Showing 1-10 of 100") with "First", "Previous", "Next", and "Last" page buttons.
- **Search:** Sticky search input bar at the top of the table component operating with debounced filtering.

---

## 7. Form Rules
To keep input handling consistent and typed:
- **Framework:** `react-hook-form` for form state and event handling.
- **Validation:** `zod` for client-side schema verification.
- **Form Controls:** Use shadcn `<Form>`, `<FormField>`, `<FormItem>`, `<FormLabel>`, `<FormControl>`, and `<FormMessage>` wrappers to maintain uniform validation layout.

---

## 8. Loading & Feedback States
Every asynchronous state modification or fetch request must expose three distinct visual states:
1. **Loading State:** Skeleton loader placeholders (`shadcn/ui` skeleton component) or localized spinners inside buttons to show progress. Never leave the UI unresponsive.
2. **Success State:** Action confirmation using toast notifications or green validation highlights.
3. **Error State:** Structured alerts detailing what went wrong with a clear action (e.g., "Retry" button) if the network request fails.

---

## 9. Accessibility (a11y)
All UI interfaces must support accessibility guidelines:
- **Labels:** Every input, switch, checkbox, and select field must be associated with an explicit `<label>` or `aria-label`.
- **Keyboard Navigation:** Users must be able to tab through forms, trigger buttons using `Enter`/`Space`, and dismiss modals using the `Escape` key.
- **ARIA Attributes:** Include appropriate `aria-expanded`, `aria-describedby`, and `aria-invalid` attributes, automatically managed by utilizing Radix primitives.

---

## 10. Responsiveness
- **Desktop (>= 1024px):** Primary target design. Full side-navigation and expanded data tables.
- **Tablet (768px - 1023px):** Supported design. Collapsible sidebar, scrolling overflow on tables.
- **Mobile (< 768px):** Required design. Sidebar collapses to a slide-out drawer (hamburger menu), and grid KPI cards stack vertically.

---

## 11. Forbidden Practices
- **NO Custom Button Components:** Always use the shadcn `Button` component with variant props (`default`, `destructive`, `outline`, `ghost`).
- **NO Custom Modal/Popup Overlays:** Always use shadcn `Dialog` or `Sheet` components.
- **NO Hardcoded Colors:** Never use raw hex/rgb codes in inline styles or Tailwind classes (e.g., `text-[#1e3a8a]`). Use design tokens.
- **NO Bypassing Design Tokens:** Custom styling overrides in CSS files must refer to tailwind variables.
