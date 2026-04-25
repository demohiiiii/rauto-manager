# AGENTS.md

Operational handbook for AI coding agents working on **rauto-manager**.
Read this file in full before making any change. It captures the conventions, hidden landmines, and review expectations that are not obvious from the source tree alone.

---

## 1. Project Overview

`rauto-manager` is a self-hosted **control plane for `rauto` network-automation agents**. It is a Next.js 16 + React 19 web console that:

- Registers `rauto` agents (HTTP or gRPC transport) and tracks their health.
- Maintains a shared device inventory across agents.
- Dispatches tasks of five types — `exec`, `template`, `tx_block`, `tx_workflow`, `orchestrate` — to the appropriate agent and records every event/callback.
- Renders a workflow / orchestration designer (ReactFlow) for the two structured dispatch types.
- Streams real-time task events to the browser via Server-Sent Events.

It is **not** the execution engine. The companion project `rauto` (Rust) actually talks to network devices. This repo only commands and observes.

---

## 2. Tech Stack — Authoritative Versions

| Layer        | Choice                                                                      | Notes for agents                                                                                         |
| ------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Framework    | Next.js **16** (App Router, Turbopack dev, RSC)                             | Uses `proxy.ts` (NOT `middleware.ts`) for request interception — see §6.                                 |
| Runtime      | React **19**, TypeScript **5.9**, Node **>= 20**                            | Server components by default; mark `"use client"` explicitly.                                            |
| Styling      | Tailwind CSS **4** + shadcn/ui (`new-york`, `zinc` base)                    | Tokens live in `app/globals.css` as HSL CSS vars; **never** hardcode hex in components. See `DESIGN.md`. |
| State / data | TanStack Query v5 (server state), Zustand v5 (client state in `lib/store/`) | Don't reach for Redux. Don't put server data in Zustand.                                                 |
| DB           | PostgreSQL via Prisma **7** with `@prisma/adapter-pg`                       | Prisma 7 **requires** the pg adapter — see `lib/prisma.ts`.                                              |
| Auth         | JWT cookie (`jose`) + bcrypt for admin password                             | HttpOnly cookie `auth-token`, 7-day expiry.                                                              |
| i18n         | `next-intl` v4 (`zh` default + `en`)                                        | All user-visible strings go through translators.                                                         |
| Realtime     | SSE for browser; gRPC (`@grpc/grpc-js`) for agent reporting (optional)      | gRPC server boots from `instrumentation.ts` only when `MANAGER_GRPC_ENABLED=true`.                       |
| Canvas       | `@xyflow/react` v12                                                         | Used by `complex-task-designer.tsx`.                                                                     |
| Icons        | `lucide-react` only                                                         | Don't introduce other icon sets.                                                                         |
| Toasts       | `sonner` (top-right, richColors)                                            | Use `toast.success / .error` in `lib/utils` style.                                                       |

---

## 3. Repository Layout

```
app/                Next.js App Router pages + API routes
  api/              Server endpoints (REST). Public auth-bypass list lives in proxy.ts.
  layout.tsx        Root layout, loads JetBrains Mono, wraps Providers + NextIntl.
  providers.tsx     QueryClient, ThemeProvider (defaultTheme="dark"), Toaster, SSE bootstrap.
  globals.css       All design tokens. Source of truth for colors/radii/motion.
components/
  ui/               shadcn primitives (Button, Card, Dialog, ...). Treat as immutable unless
                    you are changing the design system on purpose.
  layout/           AppShell: sidebar, header, dashboard wrapper.
  task-forms/       Per-dispatch-type form bodies inside Create Task dialog.
  task-result/      Renderers for execution result payloads (one per dispatch type).
  complex-task-designer.tsx   ReactFlow editor for tx_workflow / orchestrate.
hooks/              Cross-cutting client hooks (notification stream, etc.).
lib/
  prisma.ts         Singleton PrismaClient with PG adapter. Use this — never `new PrismaClient()`.
  auth.ts           JWT issue/verify + cookie helpers (server-only).
  agent-reporting.ts            HTTP-side handlers for events agents push to us.
  agent-task-grpc.ts            Outbound gRPC dispatch to agents.
  agent-reporting-http.ts       HTTP equivalent.
  dispatch.ts                   The dispatch fan-out (HTTP vs gRPC routing, timeouts, async/sync).
  notification.ts               Persist + broadcast notifications to SSE subscribers.
  task-events.ts                Persist task execution events; broadcast to SSE.
  store/                        Zustand slices (agent, task, notification UI state only).
  types/index.ts                Single source of truth for shared TS types — extend here.
  utils.ts                      `cn()`, agent/device helpers. Add small pure helpers here.
messages/           en.json, zh.json — all UI strings. Keys are nested dot-paths.
prisma/
  schema.prisma     Data model. `npx prisma migrate dev` after edits.
  migrations/       Committed. Never edit historical migrations.
proto/rauto/        gRPC .proto files mirroring the rauto agent API.
server/grpc/        Manager-side gRPC reporting server (Node-only, lazy-loaded).
proxy.ts            Next.js 16 proxy (was middleware.ts in <16). Auth gate.
instrumentation.ts  Boots optional gRPC server in non-Vercel Node runtime.
i18n/request.ts     next-intl request config (locale resolution).
```

---

## 4. Design System — `DESIGN.md`

**Before touching any UI, color, spacing, motion, or component-styling code, read [`DESIGN.md`](./DESIGN.md) at the repo root.** It is the single source of truth for the product's visual identity and contains both:

- **YAML frontmatter** with all structured design tokens (colors light + dark, accent themes, typography scale, spacing, radii, elevation, motion, iconography, and 40+ component-level tokens).
- **Free-form Markdown** describing brand intent, dual-mode philosophy (clinical light mode / cyberpunk-cyan dark mode), motion semantics, and every major component's styling rationale.

### When you must consult `DESIGN.md`

- Adding or restyling **any component** in `components/` (especially `components/ui/`, `components/layout/`, dialogs, badges, cards, dispatch tiles).
- Choosing a **color** for a new state, status, or affordance — pick from the semantic palette there, do not invent hex values.
- Adding **motion** (transitions, animations, hover effects) — the file enumerates the exact named animations (`fade-in`, `scan-line`, `glow-pulse`, `status-pulse`, `shimmer`, `hover-lift`, etc.) and when each is appropriate.
- Touching the **ReactFlow canvas** (`complex-task-designer.tsx`) — selection halos, edge glow, node card treatment, and `--flow-*` variables are documented there.
- Working on a **terminal / code output block** — the dark `#09090b` surface, `JetBrains Mono` 12px body, and bright semantic accents (`#4ade80` / `#22d3ee` / `#fbbf24`) are codified.
- Adding any **dialog title** — they begin with the `>_` terminal-prompt glyph as part of the type block.

### What `DESIGN.md` codifies that the code does not

- The **dual personality**: light mode is monochrome / clerical (near-black `#18181b` primary on near-white `#fafafa`); dark mode pivots to neon mint-cyan `#00ffe0` primary on `#04060d` deep-navy with cyan glow halos.
- The **5 swappable accent themes** (neutral / blue / green / purple / orange / rose) — only `primary` and `ring` move; greys and semantics stay put.
- **JetBrains Mono is the global UI typeface**, not just for code. Never override `font-family` per component.
- **Motion is restrained in light, expressive in dark.** `glow-pulse` and `scan-line` exist for the dark-mode "server-rack" atmosphere — do not apply them indiscriminately in light mode.
- The **`>_` glyph** is part of the brand and prefixes dialog titles, terminal output, and certain status rows.

### Hard rules derived from `DESIGN.md`

- ❌ Never hardcode color hex values in JSX or component CSS — go through Tailwind tokens (`bg-primary`, `text-muted-foreground`, `border`, `ring`, etc.) or the CSS variables in `app/globals.css`.
- ❌ Never override `font-family` for a single component to use Inter / Geist / system-ui — the monospace UI is a brand decision.
- ❌ Never patch `components/ui/*` shadcn primitives for one-off needs — extend via a new `cva` variant.
- ✅ When you add a token to `app/globals.css`, also add it to `DESIGN.md`'s YAML frontmatter so the two stay in sync.
- ✅ When you add a component, add a corresponding `components.<name>` entry to `DESIGN.md`'s YAML if it has any non-trivial styling.

If `app/globals.css` and `DESIGN.md` ever disagree, **`DESIGN.md` is the source of truth** for design intent — update `globals.css` (or the component) to match, not the other way around.

---

## 5. Setup & Daily Commands

```bash
# Install (postinstall runs `prisma generate` automatically)
npm install

# Configure env
cp .env.example .env
# Required:  DATABASE_URL, JWT_SECRET, AGENT_API_KEY
# Optional:  NEXT_PUBLIC_AGENT_API_KEY, NEXT_PUBLIC_MANAGER_URL,
#            NEXT_PUBLIC_MANAGER_GRPC_URL, MANAGER_GRPC_ENABLED, ...

# Migrate DB (use `dev` locally to iterate schema, `deploy` in CI/prod)
npx prisma migrate dev      # interactive, generates migration
npx prisma migrate deploy   # CI / production (also baked into build:vercel)

# Develop
npm run dev                 # next dev --turbopack on :3000

# Quality gates — run BOTH before declaring a task done
npm run lint
npm run type-check          # tsc --noEmit, strict

# Production build
npm run build               # plain build
npm run build:vercel        # prisma migrate deploy + next build (used on Vercel)
```

There is **no test runner configured**. If you add tests, install Vitest + React Testing Library and add a `test` script — do not introduce Jest (it conflicts with Next 16 Turbopack assumptions).

First-run flow: `/login` auto-redirects to `/setup` until an `Admin` row exists. Don't bypass this in code.

---

## 6. Coding Conventions

### TypeScript

- **Strict mode is on.** Never silence with `any` casually. Prefer `unknown` + narrowing, or extend `lib/types/index.ts`.
- **Path alias.** Use `@/...` for absolute imports (configured in `tsconfig.json` and `components.json`). Do not write `../../../`.
- **Server / client split.** Files are server components by default. Add `"use client"` only when you actually need state, effects, browser APIs, or context. Hooks must be in client files. Never import `lib/prisma.ts` or `lib/auth.ts` from a client component.
- **Server-only modules.** `lib/prisma.ts`, `lib/auth.ts`, anything in `server/grpc/`, `app/api/**`, and any file that touches `process.env.AGENT_API_KEY` / `JWT_SECRET` must stay server-side.

### React

- Functional components only. No class components.
- Use `next/link` for navigation, `next/navigation` for `useRouter` / `usePathname`.
- For data fetching in client components, use TanStack Query (`useQuery`) — see `app/page.tsx` for the established pattern (30s `refetchInterval` for dashboards is the convention). Default `staleTime` is 60s, `refetchOnWindowFocus: false`.

### Styling

- Use Tailwind utility classes + `cn()` from `lib/utils`.
- **Never hardcode colors.** Use semantic tokens: `bg-card`, `text-muted-foreground`, `border`, `ring`, `bg-primary`, etc. The token list and intent live in `DESIGN.md` and `app/globals.css`.
- The global font is **JetBrains Mono** for the entire UI, not just code. Don't override `font-family` per component.
- Dark mode is the **default theme** (`defaultTheme="dark"` in `providers.tsx`). Test both modes whenever you touch color or borders.
- shadcn/ui components in `components/ui/` are stylistically locked. If you need a variant, add a new `cva` variant — do not patch the base component for one-off needs.

### i18n — Mandatory

- **Every user-visible string must come from `messages/{en,zh}.json`** via `useTranslations(namespace)` (client) or `getTranslations(namespace)` (server).
- When you add a key, add it to **both** `en.json` and `zh.json`. The `zh` translation is the primary; `en` follows.
- Namespace conventions: `common`, `nav`, `dashboard`, `agents`, `devices`, `tasks`, `tasks.dispatchType.*`, `history`, `settings`, `notifications`. Reuse existing keys before inventing new ones.
- For server-side translation in API routes / dispatch logic, use `getSystemTranslator()` from `app/api/utils/i18n` (see `lib/dispatch.ts` for the pattern).

### File / symbol naming

- Files: kebab-case (`add-device-dialog.tsx`, `agent-reporting.ts`).
- React components: PascalCase, exported by name, one primary export per file.
- Hooks: `use-*.ts` in `hooks/`, exported as `useFoo`.
- Types: PascalCase in `lib/types/index.ts`. Use `interface` for object shapes you might extend, `type` for unions / aliases.

### Comments & docs

- The codebase is sparsely commented on purpose. **Do not add or delete comments unless asked**, except for inline JSDoc that explains non-obvious cross-process contracts (e.g., the kebab-case ↔ PascalCase record-level mapping in `lib/dispatch.ts`).

---

## 7. Architecture — Things That Will Bite You

### 7.1 `proxy.ts` is the auth gate

Next.js 16 renamed middleware → **proxy**. The file at the repo root is `proxy.ts`, exporting `proxy(request)` and a `config.matcher`. It validates the `auth-token` JWT cookie on every non-public route and redirects unauthenticated users to `/login?from=...`.

The **`PUBLIC_PATHS`** list inside `proxy.ts` is critical — it lets agents talk to us with `X-API-Key` instead of a JWT cookie. **If you add a new endpoint that an agent must call, you must whitelist it there.** Never add `/api/auth/*` style paths casually; understand whether the endpoint should accept agent-key auth, JWT auth, or both.

### 7.2 Two auth models in one app

| Caller          | Auth                                                            | Endpoints                                                                  |
| --------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Browser (admin) | `auth-token` HttpOnly JWT cookie                                | Everything except agent-callback paths                                     |
| `rauto` agent   | `Authorization: Bearer <AGENT_API_KEY>` (HTTP) or gRPC metadata | `/api/agents/{register,heartbeat,offline,report-*}`, `/api/tasks/callback` |

Do not collapse these into one. Agent endpoints must remain stateless and cookie-free.

### 7.3 Dispatch routing — HTTP vs gRPC

`lib/dispatch.ts` is the single fan-out point. It picks transport based on the agent's stored `reportMode`:

- `reportMode === "grpc"` **and** the dispatch type has an async gRPC RPC (`tx_block`, `tx_workflow`, `orchestrate`) → `dispatchTaskOverGrpc(...)` from `lib/agent-task-grpc.ts`.
- otherwise → HTTP `POST` to `http://{host}:{port}{HTTP_DISPATCH_ENDPOINT_MAP[type]}` with `AbortSignal.timeout(...)`.

Five dispatch types → five async endpoint paths → three timeout buckets. **All five manager-side dispatch types are treated as async** and must resolve to agent-side **`202 Accepted`** semantics. Don't reintroduce synchronous manager expectations unless `rauto`'s contract changes first.

`tx_block` is special: the UI still captures a granular form payload, but Manager is responsible for serializing command-based input into the latest `TxBlock` JSON shape before dispatch. Keep `lib/tx-block-serialize.ts` as the single source of truth for that transformation. Template-only `tx_block` requests may still forward `tx_block_template_name`, but once command steps are present, Manager-authored `tx_block` JSON is authoritative.

`record_level` is sent to the agent in **kebab-case** (`key-events-only`), but stored and shown in the manager as **PascalCase** (`KeyEventsOnly`). The mapping is in `lib/dispatch.ts`. Always preserve this asymmetry.

### 7.4 Optional gRPC reporting server

`instrumentation.ts` lazy-loads `server/grpc/agent-reporting-server` when **all** of:

- `process.env.NEXT_RUNTIME === "nodejs"` (not edge)
- `MANAGER_GRPC_ENABLED === "true"`
- `MANAGER_GRPC_DISABLED !== "true"`
- `VERCEL !== "1"`

On Vercel the manager is HTTP-only — agents must use `--report-mode http` there. Don't add static imports of `server/grpc/*` from anywhere reachable in a Vercel build.

### 7.5 Prisma 7 + pg adapter

Prisma 7 requires the connection to flow through `@prisma/adapter-pg` (`lib/prisma.ts`). Do not instantiate `new PrismaClient()` directly anywhere else — always import the singleton from `lib/prisma`. The `normalizeDatabaseUrl` helper auto-injects `uselibpqcompat=true` when `sslmode=require` is set; preserve that behavior.

`Agent.uptimeSeconds` is a **BigInt**. Use `serializeAgent()` from `lib/utils.ts` before sending an Agent over JSON, or it will throw on `JSON.stringify`.

### 7.6 SSE notifications

`/api/notifications/stream` is a long-lived SSE response. The client subscribes via `useNotificationStream()` (booted once in `providers.tsx` via `<NotificationProvider />`). When you produce a notification, call `lib/notification.ts` helpers — they handle DB persistence **and** SSE broadcast in one step. Do not insert directly into the `Notification` table from a route handler.

Same pattern for task execution events: write through `lib/task-events.ts`, never raw Prisma.

### 7.7 Effective device status

A device's stored `status` is **not** what the UI displays. `getEffectiveDeviceStatus()` / `getEffectiveDeviceState()` in `lib/utils.ts` overlay the agent's online/busy state on top: if the agent is offline, the device is forced to `unreachable` with `statusReason: "agent_offline"`. Always render via these helpers — never read `device.status` straight from the DB into the UI.

### 7.8 ReactFlow canvas tokens

The workflow designer uses CSS variables prefixed `--flow-*` defined in `app/globals.css` (different values in light vs dark) and wired through the `.rauto-flow-canvas` class. The intent and rationale for selection halos, edge glow, and node card treatment are documented in **`DESIGN.md`** under the `flow-canvas-surface`, `flow-node-card`, `flow-node-card-selected`, `flow-edge`, and `flow-edge-selected` component blocks. If you adjust selection styles, edit those CSS variables — **don't** override ReactFlow internals with arbitrary classes.

---

## 8. Database & Migrations

- Schema lives in `prisma/schema.prisma`. Models: `Agent`, `Device`, `Task`, `ExecutionHistory`, `TaskExecutionEvent`, `Admin`, `Notification`, `SystemConfig`, `AgentErrorReport`.
- After any schema change: `npx prisma migrate dev --name <short_snake_case>`. Commit the generated SQL under `prisma/migrations/`.
- **Never edit a previously committed migration.** If a migration is wrong, write a new corrective migration.
- Seed data: there is no seed script. The first admin is created interactively at `/setup` → `POST /api/auth/init`.
- For Vercel + Neon, a separate `DIRECT_DATABASE_URL` may be required for migrations. The README documents this.

---

## 9. Quality Gates Before You Hand Back Work

A change is **not done** until all of the following pass:

1. `npm run lint` — zero new warnings.
2. `npm run type-check` — zero errors.
3. The change builds (`npm run build`) if it touches anything load-bearing (server actions, API routes, prisma schema, providers, proxy).
4. If you added a migration, you ran `npx prisma migrate deploy` against a real test DB, or at minimum verified the SQL by hand.
5. If you added a string, both `messages/en.json` and `messages/zh.json` have it.
6. If you touched a route, you confirmed the path-auth decision in `proxy.ts` is still correct.
7. If you touched UI, you sanity-checked light AND dark mode and the collapsed sidebar state.

There is no CI test suite to lean on — these manual checks **are** the safety net.

---

## 10. Pull Request / Change Description Guidelines

When summarizing a change for a human reviewer:

- State the user-facing effect first (`"Adds a 'Cancel running task' button to the task detail dialog"`), then the implementation summary.
- Call out any of: new env var, new public API path, schema migration, change to `proxy.ts` `PUBLIC_PATHS`, change to dispatch contract, change to design tokens.
- Link the relevant `messages/*.json` keys for any new copy.
- Note explicitly when behavior differs between HTTP and gRPC agents.

Keep PRs scoped. Schema migrations should not share a PR with unrelated UI work.

---

## 11. Things You Should NOT Do

- ❌ Don't add a new icon library — use `lucide-react`.
- ❌ Don't add a new state library — use TanStack Query for server state, Zustand for UI state.
- ❌ Don't introduce Sass, styled-components, emotion, or CSS-in-JS — Tailwind only.
- ❌ Don't replace `proxy.ts` with `middleware.ts` — Next.js 16 expects `proxy.ts`.
- ❌ Don't import server modules (`prisma`, `auth`, gRPC server) from client components.
- ❌ Don't hardcode color hex values in JSX/CSS — go through CSS variables / Tailwind tokens.
- ❌ Don't insert into `Notification` or `TaskExecutionEvent` tables directly — use the helpers in `lib/notification.ts` / `lib/task-events.ts` so SSE subscribers see the event.
- ❌ Don't read `device.status` raw — always pass through `getEffectiveDeviceStatus`.
- ❌ Don't `JSON.stringify(agent)` without `serializeAgent()` first (BigInt).
- ❌ Don't broaden `proxy.ts` `PUBLIC_PATHS` without an explicit security justification.
- ❌ Don't add dependencies casually. The dependency list is intentionally lean — justify additions.
- ❌ Don't add comments or documentation to existing files unless the user explicitly asked.
- ❌ Don't commit secrets. `.env` is gitignored; `.env.example` is the contract.

---

## 12. Useful Pattern Snippets

**Read-only data fetch in a client component:**

```tsx
"use client";
import { useQuery } from "@tanstack/react-query";

const { data, isLoading, refetch } = useQuery({
  queryKey: ["agents"],
  queryFn: async () => {
    const res = await fetch("/api/agents");
    if (!res.ok) throw new Error("failed");
    return res.json();
  },
  refetchInterval: 30_000,
});
```

**Server route with admin auth:**

```ts
import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401 },
    );
  }
  const agents = await prisma.agent.findMany();
  return NextResponse.json({ success: true, data: agents.map(serializeAgent) });
}
```

**Dispatching to an agent:**

```ts
import { dispatchToAgent } from "@/lib/dispatch";

const result = await dispatchToAgent({
  agent: { host, port, reportMode },
  type: "exec",
  taskId,
  callbackUrl: `${managerUrl}/api/tasks/callback`,
  connection,
  payload: { command: "show version" },
  recordLevel: "KeyEventsOnly",
});
```

**Translated string (client):**

```tsx
const t = useTranslations("dashboard");
return <h1>{t("title")}</h1>;
```

---

## 13. When In Doubt

1. Check **[`DESIGN.md`](./DESIGN.md)** for any visual / token / motion / color decision.
2. Check `lib/types/index.ts` for the canonical shape of any cross-cutting object.
3. Check `proxy.ts` for what is and isn't authenticated.
4. Check `lib/dispatch.ts` for the contract with `rauto` agents.
5. Re-read the relevant section of this file.
6. If still unsure, ask for clarification rather than guessing — this is a control plane for production network gear, and silent regressions are expensive.
