# Collaborative Real-Time App — Full-Stack Plan

## Top-Level Overview

Build a **real-time collaborative platform** from scratch in two phases:

- **Phase 1 (current plan):** Live whiteboard — multiple users draw (freehand, shapes, text labels) on a shared canvas and see each other's changes **instantly — no page refresh**.
- **Phase 2 (future release):** Mini Google Docs — rich text document editor with the same real-time OT sync, leveraging the exact same Socket.IO + ShareDB infrastructure built in Phase 1.

### Tech Stack
| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router, TypeScript) |
| Backend | Node.js + Express + Socket.IO (Dockerized) |
| Auth | Auth.js / NextAuth — email/password + Google OAuth |
| Database | PostgreSQL through Prisma ORM |
| Real-time state sync | ShareDB (Operational Transformation engine) over Socket.IO |
| Canvas rendering | Fabric.js |
| Horizontal scaling bus | Redis (Socket.IO Redis Adapter only) |
| Containerization | Docker + docker-compose |
| Learning artifact | `ALGORITHM.md` — OT algorithm deep-dive |

### Non-Goals (Phase 1)
- Rich text / Google Docs-style editing — **deferred to Phase 2**
- Video/audio communication
- File export (PDF/PNG) — not in scope yet
- Full OT op-log persistence (MemoryBackend + PostgreSQL snapshot flush is sufficient; undo/redo is Phase 2)

---

## Sub-Tasks

---

### Sub-Task 1 — Monorepo & Project Scaffold

**Status:** `[x] done`

**Intent**
Create the root folder structure, `docker-compose.yml`, and all `package.json` / config files so every subsequent sub-task has a stable home. This is the skeleton every other task depends on.

**Expected Outcomes**
- Root folder contains `apps/web` (Next.js) and `apps/server` (Node.js)
- `docker-compose.yml` defines three services: `web`, `server`, `redis`
- Both apps run with `docker compose up` (even if pages are blank)
- TypeScript configured in both apps
- ESLint + Prettier set up

**Todo List**
1. Create root `package.json` with workspaces pointing to `apps/*`
2. Scaffold `apps/web` with `create-next-app` (TypeScript, App Router, Tailwind)
3. Scaffold `apps/server` as a plain Node.js + Express + TypeScript project
4. Write `apps/server/Dockerfile` (multi-stage: build → production)
5. Write `apps/web/Dockerfile`
6. Write root `docker-compose.yml` with `web`, `server`, `redis` services
7. Add `.env.example` files for both apps listing all required environment variables
8. Verify `docker compose up` boots without errors
**Relevant Context**
- `apps/server` will expose port `4000`; `apps/web` will expose port `3000`
- Redis uses the official `redis:7-alpine` image, port `6379`
- No business logic yet — just skeleton routes and a health-check endpoint

---

### Sub-Task 2 — Authentication (Auth.js + Prisma)

**Status:** `[x] done`

**Intent**
Wire up Auth.js so users can register/login with email+password and Google OAuth. Prisma stores users, accounts, and sessions. The authenticated Auth.js token is passed to the Node.js backend on every Socket.IO connection so the server can verify identity before allowing board access.

**Expected Outcomes**
- `/login` and `/register` pages exist in Next.js with working forms
- Google OAuth button triggers Auth.js OAuth flow and redirects back
- A `useUser()` hook (or Auth.js client helper) exposes the current session
- Protected routes redirect unauthenticated users to `/login`
- The Node.js server validates the Auth.js JWT on WebSocket handshake and rejects invalid connections

**Todo List**
1. Configure Google OAuth credentials and `NEXTAUTH_SECRET` in `.env`
2. Enable Google OAuth provider and configure its callback URL in Google Cloud Console
3. Install `next-auth`, `@next-auth/prisma-adapter`, and `bcryptjs` in `apps/web`
4. Create `apps/web/src/lib/auth.ts`, `apps/web/src/lib/prisma.ts`, and Auth.js route handlers
5. Create Next.js middleware (`middleware.ts`) to protect routes via Auth.js session cookie
6. Build `/login` page — email/password form + Google OAuth button
7. Build `/register` page — email/password sign-up form
8. Auth.js manages OAuth callbacks through `/api/auth/[...nextauth]`
9. Create `useUser()` custom hook using `next-auth/react`
10. On the Node.js server: install `jose` and write `middleware/verifyToken.ts` that decrypts the Auth.js JWT from the Socket.IO handshake auth payload
11. Reject Socket connections whose token is missing or invalid

**Relevant Context**
- `apps/web/src/lib/auth.ts` and `apps/web/src/lib/prisma.ts` — Auth.js and Prisma helpers
- `apps/server/src/middleware/verifyToken.ts` — Socket.IO connection middleware
- Environment variables needed: `DATABASE_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

---

### Sub-Task 3 — Database Schema (PostgreSQL + Prisma)

**Status:** `[x] done`

**Intent**
Define the data model in PostgreSQL using Prisma for users, boards, and board snapshots. The board snapshot stores the latest serialized canvas state so a newly joining user loads the current state without replaying every historical OT operation.

**Expected Outcomes**
- Prisma models exist for users, Auth.js accounts/sessions, boards, snapshots, and memberships
- `prisma/schema.prisma` is the single database schema source of truth
- Prisma migrations document all schema changes
- Board membership authorization is enforced in the Node.js repository layer

**Todo List**
1. Create `prisma/schema.prisma` with `User`, `Account`, `Session`, `VerificationToken`, `Board`, `BoardSnapshot`, and `BoardMember` models
2. Create Prisma migrations for the schema
3. Create `apps/server/src/lib/prisma.ts` and typed `apps/server/src/db/boards.ts` helpers
4. Create Next.js server actions and `/dashboard` using Prisma

**Relevant Context**
- `board_snapshots.state` column is `jsonb` — stores the full Fabric.js canvas JSON
- Snapshot is upserted (not appended) — only the latest state matters for cold-join loading
- OT operation history is held in-memory in ShareDB (not persisted in phase 1)
- PostgreSQL is the durable store through Prisma

---

### Sub-Task 4 — Node.js Real-Time Server (Socket.IO + Redis Adapter)

**Status:** `[x] done`

**Intent**
Build the core Socket.IO server that handles board rooms, broadcasts drawing events between clients, and attaches the Redis adapter for horizontal scaling. This sub-task does NOT include OT yet — it establishes the event plumbing first.

**Expected Outcomes**
- Server accepts WebSocket connections authenticated by Auth.js JWT
- Clients can emit `join-board` with a `boardId` and be placed in the correct Socket.IO room
- Server relays `draw-op` events to all other members of the same room
- `user-joined` and `user-left` presence events are broadcast to the room
- Redis adapter is wired up; the server can scale to multiple instances without missed messages
- Health-check HTTP endpoint at `GET /health` returns `200 OK`

**Todo List**
1. Install `socket.io`, `express`, `@socket.io/redis-adapter`, `ioredis` in `apps/server`
2. Create `apps/server/index.ts` — Express app + `http.createServer` + `Socket.IO` attachment
3. Create `apps/server/socket/index.ts` — Socket.IO server config with Redis adapter initialization
4. Write the `verifyToken` middleware (from Sub-Task 2) and attach it to Socket.IO's `io.use()`
5. Handle `connection` event: extract `userId` from verified token, attach to `socket.data`
6. Handle `join-board` event: `socket.join(boardId)`, emit `user-joined` to room
7. Handle `draw-op` event: `socket.to(boardId).emit('draw-op', op)` (relay only, no OT yet)
8. Handle `disconnect` event: emit `user-left` to room
9. Write `GET /health` Express route
10. Verify with a simple browser console test that two tabs share events

**Relevant Context**
- Redis connection string from env: `REDIS_URL=redis://redis:6379`
- `socket.data.userId` — canonical place to store authenticated user ID
- `draw-op` payload shape will be locked down in Sub-Task 5 when OT is added

---

### Sub-Task 5 — Operational Transformation Layer (ShareDB + ALGORITHM.md)

**Status:** `[x] done`

**Intent**
Integrate ShareDB as the OT engine on the Node.js server. Replace the dumb relay of Sub-Task 4 with a proper OT pipeline: each `draw-op` is an OT operation that ShareDB transforms against concurrent operations before applying, guaranteeing all clients converge to the same state. Write `ALGORITHM.md` explaining every step.

**Expected Outcomes**
- ShareDB is initialized with an in-memory backend (no DB adapter needed in phase 1)
- Each board has a ShareDB document identified by `boardId`
- Client-submitted operations are submitted to ShareDB; ShareDB transforms and rebroadcasts the acknowledged (transformed) operation
- Two concurrent conflicting operations (e.g. two users moving the same object) converge correctly on all clients
- `ALGORITHM.md` exists in the repo root with a full explanation of:
  - What OT is and why it is needed
  - The `transform(op1, op2, side)` function contract
  - How ShareDB manages the operation log and version vector
  - The client acknowledgement / retry loop
  - A worked example with two concurrent ops shown step-by-step
  - Comparison table: OT vs CRDT (Yjs)

**Todo List**
1. Install `sharedb`, `@types/sharedb` in `apps/server`
2. Create `apps/server/ot/sharedb.ts` — initialize ShareDB backend with `MemoryBackend`
3. Define the canvas document type: a JSON object where keys are object IDs and values are shape descriptors (position, type, fill, path data, etc.)
4. On `join-board`: open or create the ShareDB document for `boardId`, send its current snapshot to the joining client via `board-snapshot` event
5. On `draw-op`: validate the incoming op, call `doc.submitOp(op)`, ShareDB handles transformation; broadcast the committed op + new version to the room
6. On `disconnect`: close the ShareDB document connection for that client
7. On the Next.js side: create `apps/web/lib/ot/client.ts` — lightweight OT client that tracks local version, buffers unacknowledged ops, and applies incoming remote ops
8. Implement the client-side **acknowledge / retry** loop: if an op is not acknowledged within N ms, resubmit
9. Write `ALGORITHM.md` in the repo root (full learning document)
10. Write inline comments in `apps/server/ot/sharedb.ts` and `apps/web/lib/ot/client.ts` explaining every OT decision

**Relevant Context**
- ShareDB doc type used: `json0` (default) — supports object key set/delete/insert ops
- `draw-op` payload: `{ docId: boardId, op: json0Op, version: number }`
- Client must send the version it last saw; ShareDB rejects ops against stale versions and triggers a resync
- `ALGORITHM.md` is a first-class deliverable for the learning goal

---

### Sub-Task 6 — Canvas Frontend (Fabric.js Whiteboard)

**Status:** `[x] done`

**Intent**
Build the `/board/[id]` page with a full-featured Fabric.js canvas. Every local drawing action is converted into an OT operation and sent to the server. Incoming OT operations from the server are applied to the canvas without triggering another outbound operation (avoiding infinite loops).

**Expected Outcomes**
- `/board/[id]` page renders a full-viewport Fabric.js canvas
- Toolbar supports: freehand pencil, rectangle, circle, line, text label, select/move, color picker, stroke width
- Every canvas mutation fires a `draw-op` via Socket.IO
- Incoming `draw-op` events from the server update the canvas silently (no echo)
- The canvas loads the board snapshot on join (cold start)
- Cursor positions of other users are shown as colored dots with their name (presence layer)
- The page is protected — unauthenticated users are redirected to `/login`

**Todo List**
1. Install `fabric` and `@types/fabric` in `apps/web`
2. Create `apps/web/components/whiteboard/Canvas.tsx` — Fabric.js canvas wrapped in a React `useRef`
3. Initialize Fabric.js in a `useEffect`; set canvas size to fill viewport
4. Create `apps/web/hooks/useSocket.ts` — connects to the Node.js server with the Auth.js JWT in `auth` handshake
5. On canvas `object:modified`, `object:added`, `object:removed` — serialize the delta as a `json0` op and emit `draw-op`
6. Set a `_fromRemote` flag before applying incoming ops to suppress re-emission
7. Create `apps/web/components/whiteboard/Toolbar.tsx` — tool buttons wired to Fabric.js drawing modes
8. Create `apps/web/components/whiteboard/PresenceCursors.tsx` — overlays colored cursors from `cursor-move` events
9. Emit `cursor-move` events on `mousemove` (throttled to 30 fps)
10. On `board-snapshot` event: load the JSON state via `canvas.loadFromJSON()`
11. Create the `/board/[id]` page route that mounts Canvas + Toolbar + PresenceCursors

**Relevant Context**
- `_fromRemote` flag pattern: set `canvas._fromRemote = true` before `applyOp()`, reset in the event handler's first line to prevent echo
- Fabric.js `canvas.toJSON()` / `canvas.loadFromJSON()` are the serialization entry points
- `apps/web/lib/ot/client.ts` (from Sub-Task 5) is the bridge between Fabric events and Socket.IO

---

### Sub-Task 7 — Dashboard & Board Management UI

**Status:** `[x] done`

**Intent**
Build the authenticated home screen where users manage their boards — create new boards, see existing ones, and navigate into them.

**Expected Outcomes**
- `/dashboard` lists the user's boards (title, last updated) fetched from Auth.js
- "New Board" button creates a board via server action and redirects to `/board/[id]`
- Each board card links to `/board/[id]`
- Board title is editable inline
- User avatar + logout button in header

**Todo List**
1. Create `apps/web/src/app/dashboard/page.tsx` — server component that fetches boards through Prisma
2. Create `apps/web/components/dashboard/BoardCard.tsx` — card component with title, date, link
3. Create `apps/web/src/app/actions/board.ts` — `createBoard` server action using `getServerSession`
4. Create `apps/web/components/dashboard/NewBoardButton.tsx` — calls server action, redirects
5. Add inline title editing: `PATCH /api/boards/[id]` API route updates `boards.title` through Prisma
6. Create `apps/web/components/layout/Header.tsx` — user avatar, username, logout through Auth.js
7. Add root layout redirect: unauthenticated users at `/` go to `/login`, authenticated users go to `/dashboard`

**Relevant Context**
- Server actions live in `apps/web/src/app/actions/`
- Auth.js configuration: `apps/web/src/lib/auth.ts`
- Prisma client: `apps/web/src/lib/prisma.ts`

---

### Sub-Task 8 — Snapshot Persistence & Cold-Join Load

**Status:** `[x] done`

**Intent**
Persist the canvas state to PostgreSQL through Prisma so that when a user opens a board after it has been idle, they load the last known state rather than a blank canvas. The server periodically upserts the ShareDB document snapshot into the `board_snapshots` table.

**Expected Outcomes**
- When the last user leaves a board room, the server saves the current ShareDB snapshot to `board_snapshots`
- When the first user joins an empty room, the server loads the snapshot from PostgreSQL through Prisma into ShareDB's memory before sending it to the client
- The whiteboard page loads with the correct previous state, not blank

**Todo List**
1. In `apps/server/socket/index.ts`: track connected users per board using a `Map<boardId, Set<socketId>>`
2. On `disconnect`: if the room becomes empty, call `db.upsertSnapshot(boardId, doc.data)` (from Sub-Task 3 helper)
3. On `join-board`: if the room was empty (first joiner), call `db.getSnapshot(boardId)` and initialize the ShareDB document with that data before opening it
4. Add a periodic flush every 60 seconds using `setInterval` for boards with active users as a safety net
5. Test: open board → draw → close → reopen → verify state is restored

**Relevant Context**
- `db.upsertSnapshot` / `db.getSnapshot` — helpers from Sub-Task 3
- ShareDB `MemoryBackend` does not persist across server restarts; PostgreSQL through Prisma is the durable store
- The periodic flush prevents data loss if the server crashes while users are active

---

### Sub-Task 9 — End-to-End Integration & Smoke Tests

**Status:** `[ ] pending`

**Intent**
Verify the complete user journey works end-to-end: sign up → create board → draw → second user joins → both see live updates → close → reopen → state persists.

**Expected Outcomes**
- Two browser sessions on the same board see each other's strokes in real time
- Conflict scenario (two users moving the same object simultaneously) resolves without corruption
- Auth flows (email/password, Google OAuth) work completely
- `docker compose up` starts the full stack cleanly from a fresh checkout
- README documents setup and run instructions

**Todo List**
1. Write `README.md` with: prerequisites, env setup, `docker compose up` instructions, architecture overview, link to `ALGORITHM.md`
2. Manual smoke test checklist: sign-up → login → create board → draw → second tab joins → verify sync → close → reopen → verify persistence
3. Test the OT conflict path: open two tabs, both offline, draw conflicting moves, reconnect both — verify convergence
4. Fix any issues found in smoke testing
5. Add a `healthcheck` directive to `docker-compose.yml` for the `server` service
6. Ensure all `.env.example` files are accurate and complete

**Relevant Context**
- Two-tab test is sufficient for verifying OT convergence in phase 1
- No automated test framework is required in phase 1 — manual smoke tests are the acceptance bar

---

## File & Folder Map (Target State)

```
/
├── docker-compose.yml
├── README.md
├── ALGORITHM.md
├── .env.example
├── package.json                    (workspace root)
└── apps/
    ├── web/                        (Next.js)
    │   ├── app/
    │   │   ├── (auth)/
    │   │   │   ├── login/page.tsx
    │   │   │   ├── register/page.tsx
    │   │   │   └── auth/callback/route.ts
    │   │   ├── dashboard/page.tsx
    │   │   ├── board/[id]/page.tsx
    │   │   └── actions/board.ts
    │   ├── components/
    │   │   ├── whiteboard/
    │   │   │   ├── Canvas.tsx
    │   │   │   ├── Toolbar.tsx
    │   │   │   └── PresenceCursors.tsx
    │   │   ├── dashboard/
    │   │   │   ├── BoardCard.tsx
    │   │   │   └── NewBoardButton.tsx
    │   │   └── layout/Header.tsx
    │   ├── hooks/
    │   │   ├── useSocket.ts
    │   │   └── useUser.ts
    │   ├── lib/
    │   │   ├── auth.ts
    │   │   ├── prisma.ts
    │   │   └── ot/
    │   │       └── client.ts
    │   ├── middleware.ts
    │   └── Dockerfile
    └── server/                     (Node.js)
        ├── index.ts
        ├── socket/
        │   └── index.ts
        ├── ot/
        │   └── sharedb.ts
        ├── middleware/
        │   └── verifyToken.ts
        ├── db/
        │   └── boards.ts
        ├── lib/
        │   └── prisma.ts
        └── Dockerfile
```

---

## Environment Variables Reference

### `apps/web/.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SERVER_URL=http://localhost:4000
```

### `apps/server/.env`
```
PORT=4000
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
REDIS_URL=redis://redis:6379
```

---

## Learning Reference — ALGORITHM.md Outline

The `ALGORITHM.md` file will cover:

1. **Why OT exists** — the lost-update problem in concurrent editing
2. **The `transform(op1, op2, side)` contract** — what "transform" means mathematically
3. **json0 operation format** — how object mutations are encoded
4. **ShareDB internals** — version vectors, the operation log, the submit pipeline
5. **Client state machine** — `IDLE → PENDING → ACKNOWLEDGED` with the retry loop
6. **Worked example** — two users moving the same rectangle, step-by-step with before/after state
7. **Conflict resolution invariants** — convergence proof sketch
8. **OT vs CRDT comparison** — when to use each

---

## Phase 2 — Mini Google Docs (Document Editing)

> **Status: Planned — not started. Implement only after Phase 1 is fully complete and stable.**

Phase 2 reuses the entire Phase 1 infrastructure (Auth.js, Socket.IO server, ShareDB, Redis, Prisma) and adds a rich-text document editing experience alongside the whiteboard.

---

### Phase 2 — Sub-Task A: Document Data Model

**Status:** `[ ] pending`

**Intent**
Extend the database schema to support text documents. A document is a separate entity from a whiteboard board — different content type, same room/session model.

**Expected Outcomes**
- `documents` table in Auth.js Postgres: `id`, `owner_id`, `title`, `created_at`
- `document_snapshots` table: `document_id`, `content` (jsonb — ProseMirror/Quill JSON), `updated_at`
- `document_members` join table: `document_id`, `user_id`, `role`
- RLS policies mirroring the board tables
- Dashboard updated to show both Boards and Documents tabs

**Todo List**
1. Extend `prisma/schema.prisma` with `Document`, `DocumentSnapshot`, and `DocumentMember` models
2. Create a Prisma migration for the document tables
3. Add `getDocument`, `upsertDocumentSnapshot`, `getDocumentSnapshot` DB helpers in `apps/server/db/documents.ts`
4. Update `/dashboard` to show a "Documents" tab alongside "Boards"
5. Create a "New Document" server action that inserts a row and redirects to `/doc/[id]`

**Relevant Context**
- Mirrors the board data model exactly — same patterns, different table names
- `document_snapshots.content` stores ProseMirror JSON (not raw HTML)

---

### Phase 2 — Sub-Task B: ProseMirror Rich-Text Editor

**Status:** `[ ] pending`

**Intent**
Integrate ProseMirror as the rich-text editor on the `/doc/[id]` page. ProseMirror's transaction model maps directly to OT operations, making it the natural fit for ShareDB integration.

**Expected Outcomes**
- `/doc/[id]` page renders a full ProseMirror editor
- Toolbar: bold, italic, underline, headings (H1–H3), bullet list, numbered list, blockquote
- Editor loads the document snapshot from Auth.js on first open
- Editor is protected — unauthenticated users are redirected to `/login`

**Todo List**
1. Install `prosemirror-state`, `prosemirror-view`, `prosemirror-model`, `prosemirror-schema-basic`, `prosemirror-history`, `prosemirror-keymap` in `apps/web`
2. Create `apps/web/components/document/Editor.tsx` — ProseMirror view wrapped in React
3. Create `apps/web/components/document/Toolbar.tsx` — formatting buttons wired to ProseMirror commands
4. Initialize editor with content from `board-snapshot` equivalent event (`doc-snapshot`)
5. Create `/doc/[id]` page route mounting the Editor

**Relevant Context**
- ProseMirror uses immutable `Transaction` objects — each transaction maps to a ShareDB op
- Do NOT use Tiptap or Quill; ProseMirror gives direct access to the transaction layer needed for OT

---

### Phase 2 — Sub-Task C: OT Layer for Documents (ShareDB + prosemirror-changeset)

**Status:** `[ ] pending`

**Intent**
Wire ProseMirror transactions to ShareDB using the `rich-text` OT type (or `prosemirror-changeset`). Every editor transaction becomes a ShareDB operation; incoming remote ops are applied to the editor without triggering a re-emission.

**Expected Outcomes**
- Every local ProseMirror transaction is serialized as a ShareDB `rich-text` op and sent via `doc-op` event
- Incoming remote ops are applied to the editor using `applyStep` without firing another outbound op
- Concurrent edits (two users typing in the same paragraph simultaneously) converge correctly
- `ALGORITHM.md` is extended with a "Document OT" section covering text insertion/deletion transforms

**Todo List**
1. Install `sharedb-rich-text` or `@automerge/automerge` (evaluate at implementation time; prefer `sharedb-rich-text` for OT consistency with Phase 1)
2. Register the `rich-text` type with ShareDB on the server: `ShareDB.types.register(richText.type)`
3. Create `apps/server/ot/documentSharedb.ts` — separate ShareDB backend instance for documents (or reuse with a different collection)
4. Add `join-doc`, `doc-op`, `doc-snapshot` Socket.IO events mirroring the board equivalents
5. On the client: create `apps/web/lib/ot/documentClient.ts` — ProseMirror plugin that intercepts transactions, converts to rich-text ops, and emits `doc-op`
6. Apply incoming `doc-op` events as ProseMirror steps using `view.dispatch(tr)`
7. Extend `ALGORITHM.md` with a "Text OT" section: insertion/deletion conflict example

**Relevant Context**
- Text OT is conceptually simpler than canvas OT — insertions shift indices, deletions shrink them
- The `_fromRemote` flag pattern from Phase 1 canvas applies identically here
- Server-side document room management mirrors `apps/server/socket/index.ts` board logic

---

### Phase 2 — Sub-Task D: Document Snapshot Persistence & Cold-Join

**Status:** `[ ] pending`

**Intent**
Persist document content to Auth.js using the same flush strategy as Phase 1 boards — upsert on last-user-leave, periodic 60s flush, load on first-join.

**Expected Outcomes**
- Document content survives server restarts
- New user joining an active document session gets the current live state
- New user opening a document after it has been idle loads the last saved state

**Todo List**
1. Reuse `Map<docId, Set<socketId>>` presence tracking from Sub-Task 8 — extend it for documents
2. On last user leaving a document room: call `db.upsertDocumentSnapshot(docId, doc.data)`
3. On first user joining a document room: call `db.getDocumentSnapshot(docId)` and seed ShareDB
4. Reuse the 60-second periodic flush interval — extend it to cover document rooms

**Relevant Context**
- Identical pattern to Sub-Task 8 — only the table name and document type differ

---

### Phase 2 — Sub-Task E: Unified Dashboard & Navigation

**Status:** `[ ] pending`

**Intent**
Update the dashboard to surface both boards and documents in a unified UI, with clear type indicators, and update the navigation/header to support switching between them.

**Expected Outcomes**
- Dashboard shows two tabs: "Whiteboards" and "Documents"
- Each item shows title, type icon, last updated
- "New Document" and "New Board" buttons both present
- Clicking a document navigates to `/doc/[id]`; clicking a board to `/board/[id]`
- Header links updated

**Todo List**
1. Update `apps/web/app/dashboard/page.tsx` to fetch both boards and documents in parallel (two Auth.js queries)
2. Add `DocumentCard.tsx` component mirroring `BoardCard.tsx`
3. Add tab switcher component to dashboard
4. Add "New Document" button wired to server action
5. Update `Header.tsx` with navigation links for both modes

---

### Phase 2 — File Additions to Folder Map

```
apps/
├── web/
│   ├── app/
│   │   ├── doc/[id]/page.tsx          NEW
│   │   └── actions/document.ts        NEW
│   ├── components/
│   │   └── document/
│   │       ├── Editor.tsx             NEW
│   │       └── Toolbar.tsx            NEW
│   └── lib/
│       └── ot/
│           └── documentClient.ts      NEW
└── server/
    ├── ot/
    │   └── documentSharedb.ts         NEW
    └── db/
        └── documents.ts               NEW
```

---

### Phase 2 — Key Technical Notes

| Decision | Rationale |
|---|---|
| ProseMirror (not Tiptap/Quill) | Direct transaction access needed for OT mapping |
| `sharedb-rich-text` OT type | Consistent with Phase 1 ShareDB server; same transform contract |
| Same Socket.IO server | Documents use new event names on the same server — no new container needed |
| Same Redis adapter | Horizontal scaling works identically for doc rooms |
| Auth.js snapshot flush | Same strategy as Phase 1 — no new persistence pattern to learn |
