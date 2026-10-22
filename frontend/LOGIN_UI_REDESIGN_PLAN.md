# Login UI Redesign – Implementation Plan
**Project:** Automated Individual Detection System – Front‑end  
**Location:** `frontend/` (Vue 3 + Vite + PrimeVue + Pinia)  
**Goal:** Replace the current centred‑card login with a **split‑screen, modern, sleek, accessible** login page that follows the supplied UI specification.

---

## 1. Visual Layout (Desktop ≥ 768 px)

```
+---------------------------------------------------------------+
|  ┌───────────────────────┐   ┌─────────────────────────────┐ |
|  │   LEFT – BRAND PANEL   │   │   RIGHT – AUTH PANEL         │ |
|  │                       │   │                               │ |
|  │  Automated Detection   │   │  ┌───────────────────────┐  │ |
|  │  ───────────────────── │   │  │ Automated Detection    │  │ |
|  │  "Automated individual │   │  │ Sign in to your monitor│  │ |
|  │   detection and monitor│   │  │   ing dashboard        │  │ |
|  │   ing powered by CV."  │   │  ├───────────────────────┤  │ |
|  │                       │   │  │ Email      [__________] │  │ |
|  │  ● System operational │   │  │ Password   [__________] │  │ |
|  │                       │   │  │ [ ] Remember me          │  │ |
|  │                       │   │  │ [Forgot password?]       │  │ |
|  │                       │   │  │ [ Sign in ]  (primary)   │  │ |
|  │                       │   │  │                           │  │ |
|  │                       │   │  │ Don't have an account?   │  │ |
|  │                       │   │  │ Contact your admin.      │  │ |
|  │                       │   │  └───────────────────────┘  │ |
|  └───────────────────────┘   └─────────────────────────────┘ |
+---------------------------------------------------------------+
```

* **Left panel** – subtle brand area, **hidden on < 768 px** (mobile).  
* **Right panel** – frosted‑glass card (`bg: var(--color-surface) / 92%`, `backdrop-filter: blur(12px)`), rounded `var(--radius-lg)`, subtle shadow `var(--shadow-md)`.  
* **Accent colour** – single brand hue (`var(--color-accent) = #2c6ef5`) used **only** for primary button, focus rings, and the “System operational” status dot.  
* **Typography** – Inter (400/500/600/700) via Google Fonts; fluid scale via `--font-size-*` tokens.  
* **Spacing** – 4 px base (`--space-1 … --space-12`).  
* **Shadows / borders** – `var(--shadow-sm)`, `var(--color-border)` only; no heavy gradients.  

---

## 2. Responsive Behaviour

| Breakpoint | Layout |
|------------|--------|
| **≥ 1200 px** | Two equal‑width columns (50 % / 50 %). |
| **768 px – 1199 px** | Left panel fixed 40 % width, right 60 % (still side‑by‑side). |
| **< 768 px** | **Left panel hidden** (`display:none`). Right panel becomes full‑width, centred, max‑width 400 px, padding `var(--space-6)`. |
| **≤ 480 px** | Form fields stack, button full‑width (`block`), label font‑size `var(--font-size-sm)`. |

All break‑points expressed with **CSS custom properties** (`--breakpoint-*`) so a single change propagates everywhere.

---

## 3. Design‑Token File (single source of truth)

**File:** `src/assets/styles/_variables.css`

```css
:root {
  /* Colours */
  --color-bg:               #f8f9fb;
  --color-surface:          #ffffff;
  --color-surface-hover:    #f1f3f6;
  --color-border:           #e2e5eb;
  --color-text-primary:     #1a1d21;
  --color-text-secondary:   #5a5f66;
  --color-text-on-accent:   #ffffff;

  --color-accent:           #2c6ef5;
  --color-accent-hover:     #1a5bd9;
  --color-accent-soft:      rgba(44,110,245,0.08);

  --color-success:          #1e9b4a;
  --color-success-soft:     rgba(30,155,74,0.08);
  --color-warning:          #f5a623;
  --color-danger:           #e53e3e;

  /* Spacing (4 px base) */
  --space-1: 0.25rem;  --space-2: 0.5rem;  --space-3: 0.75rem;
  --space-4: 1rem;     --space-5: 1.25rem; --space-6: 1.5rem;
  --space-8: 2rem;     --space-10: 2.5rem; --space-12: 3rem;

  /* Radius */
  --radius-sm: 0.375rem; --radius-md: 0.5rem;
  --radius-lg: 0.75rem;  --radius-xl: 1rem;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.06);
  --shadow-lg: 0 12px 28px rgba(0,0,0,0.08);

  /* Transitions */
  --transition-fast: 120ms ease;
  --transition-base: 200ms ease;

  /* Typography */
  --font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont,
                 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --font-size-xs: 0.7rem;   --font-size-sm: 0.8125rem;
  --font-size-base: 0.9375rem; --font-size-lg: 1.0625rem;
  --font-size-xl: 1.25rem;  --font-size-2xl: 1.5rem;
  --font-size-3xl: 2rem;
  --font-weight-normal: 400; --font-weight-medium: 500;
  --font-weight-semibold: 600; --font-weight-bold: 700;
  --line-height-tight: 1.2; --line-height-base: 1.5;
  --line-height-relaxed: 1.75;

  /* Z‑index layers */
  --z-dropdown: 100; --z-modal: 200; --z-toast: 300; --z-tooltip: 400;
}
```

*All component‑scoped CSS will reference these tokens only – guaranteeing a **consistent, maintainable** look.*

---

## 4. Component Breakdown

| Component | Location | Responsibility | PrimeVue usage |
|-----------|----------|----------------|----------------|
| **LoginForm** | `src/components/auth/LoginForm.vue` | Pure form logic: email, password, remember‑me, forgot‑password, validation, loading spinner, error toast. Emits `submit` → calls `auth.login`. | Uses **unstyled** PrimeVue primitives (`InputText`, `Password`, `Checkbox`, `Button`, `Message`) – styled exclusively via token CSS. |
| **LoginView** | `src/views/LoginView.vue` | Split‑screen layout: left brand panel + right `<LoginForm />`. Handles responsive hide/show of left panel. | No PrimeVue components – pure HTML/CSS. |
| **UI primitives** (Button, InputText, Password, Checkbox, Message) | `src/components/ui/*` | Thin wrappers around PrimeVue *unstyled* components; only structural classes, all visual rules live in global utility sheet (`_utilities.css`). | PrimeVue `unstyled:true` in `main.ts`. |
| **Utility sheet** | `src/assets/styles/_utilities.css` | `.btn`, `.input`, `.card`, `.badge`, `.focus-ring`, `.skeleton`, etc. | Consumed by all UI primitives. |

---

## 5. Global CSS Imports

`src/styles/main.css`

```css
@import './assets/styles/_variables.css';
@import './assets/styles/_utilities.css';
@import './assets/styles/_login.css';   /* page‑specific overrides */
```

`_login.css` contains only the classes used by `LoginView` & `LoginForm` (`.login-page`, `.login-page__visual`, `.login-form`, etc.) – keeps the global namespace tidy.

---

## 6. Font Loading

Add to `index.html` (inside `<head>`):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

---

## 7. Router Guard – No Code Change Needed

Current guard (`src/router/index.ts`) already does:

```ts
if (to.meta.requiresAuth && !auth.isAuthenticated) {
  return { name: 'login', query: { redirect: to.fullPath } };
}
```

The first navigation triggers `auth.refresh()` → **401** on `/api/auth/refresh` (expected). The guard catches the unauthenticated state and redirects to `/login`, where the new UI lives.

---

## 8. Implementation Checklist (ordered)

| # | Task | Command / File | Done? |
|---|------|----------------|-------|
| 1 | Create design‑token file | `src/assets/styles/_variables.css` | ☐ |
| 2 | Create utility sheet | `src/assets/styles/_utilities.css` | ☐ |
| 3 | Add Inter font link | `index.html` | ☐ |
| 4 | Update `main.css` imports | `src/styles/main.css` | ☐ |
| 5 | Build UI primitive wrappers (Button, InputText, Password, Checkbox, Message) | `src/components/ui/*.vue` | ☐ |
| 6 | Write `LoginForm.vue` (form logic + accessibility) | `src/components/auth/LoginForm.vue` | ☐ |
| 7 | Write `_login.css` (split‑screen, card, responsive) | `src/assets/styles/_login.css` | ☐ |
| 8 | Replace `LoginView.vue` with split‑screen markup | `src/views/LoginView.vue` | ☐ |
| 9 | Verify PrimeVue config uses `unstyled:true` | `src/plugins/primevue.ts` (or `main.ts`) | ☐ |
|10| Run both dev servers & smoke‑test | `npm run dev` (backend & frontend) | ☐ |
|11| Test all login states: empty, invalid email, wrong password, loading, success, server error | Manual + Cypress/Playwright later | ☐ |
|12| Confirm redirect after successful login → `/dashboard` | Browser test | ☐ |

---

## 9. Acceptance Criteria (what “clean, sleek, modern” means)

1. **Visual** – Neutral background, single accent colour, frosted card, subtle shadow, Inter font, consistent 4 px spacing grid.  
2. **Interaction** – Immediate focus rings (`--color-accent-soft`), button loading spinner, inline error/message, smooth 200 ms transitions.  
3. **Responsive** – Works flawlessly on desktop, laptop, tablet, mobile (left panel disappears, form stays centred).  
4. **Accessibility** – Semantic HTML (`<form>`, `<label>`), `aria-invalid`, `aria-busy` on loading, visible focus outlines, colour contrast ≥ 4.5:1.  
5. **Performance** – No extra CSS frameworks; only ~2 KB gzipped token + utility CSS; PrimeVue runs in *unstyled* mode.  
6. **Maintainability** – All colours / spacing / radii defined once in `_variables.css`; adding a new page only needs to import the utility sheet.

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| PrimeVue *unstyled* components may miss some ARIA attributes. | Write thin wrappers that forward all `$attrs` and add missing roles (`role="alert"` on Message, `role="dialog"` on future modals). |
| Existing `main.ts` imports PrimeVue CSS (`primevue/resources/themes/...`). | Remove those imports; keep only `PrimeVue` plugin with `unstyled:true`. |
| Backend may not set `HttpOnly` refresh‑token cookie → repeated 401. | Verify login controller sets `res.cookie('refreshToken', token, { httpOnly:true, sameSite:'lax', secure:false, maxAge: 7*24*60*60*1000 })`. |
| Design tokens not picked up because of Vite CSS ordering. | Ensure `@import` order in `main.css` (variables → utilities → page‑specific) and that `vite.config.ts` includes `css: { preprocessorOptions: { scss: { additionalData: `` } } }` if using SCSS (not needed for plain CSS). |

---

## 11. Next Steps (after you approve)

1. **Create the markdown file** (`frontend/LOGIN_UI_REDESIGN_PLAN.md`) with the content above.  
2. **Kick‑off implementation** – start with tokens & utility sheet, then primitives, then the two login components.  
3. **Iterate** – after each step run `npm run dev` in the front‑end to visually confirm.  

---

*End of plan – ready for review.*