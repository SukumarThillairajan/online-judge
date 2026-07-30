# Ascend: The Next Generation Interviewer

An online judge that does not just grade your code. It interviews you.

Pick a problem and you are dropped into a 45-minute mock interview with an AI examiner that runs a real interview loop: it withholds the constraints until you ask for them, refuses to let you write code before you have explained your approach, pushes back on brute force, and watches your editor while you work. When the timer stops, your transcript and your final submission are graded against a 100-point rubric and mapped to a gamified rank.

Underneath it is a full online judge — sandboxed multi-language execution, hidden test cases, verdicts, and per-problem leaderboards.

**Live:** [online-judge-sable.vercel.app](https://online-judge-sable.vercel.app)

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Repository Layout](#repository-layout)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Migrations](#database-migrations)
- [API Reference](#api-reference)
- [Execution Sandbox](#execution-sandbox)
- [Grading & Ranks](#grading--ranks)
- [Deployment](#deployment)
- [Documentation](#documentation)

---

## Features

### The AI Interviewer

- **Six-phase state machine.** Greeting → Problem reveal → Approach discussion → Complexity analysis → Coding → Follow-ups. The model is prompt-constrained to advance one step at a time and never to write your solution for you.
- **Earned information.** Sample test cases are handed over on request. Constraints stay hidden until you ask or until you propose a brute force and get pushed to optimize.
- **Ghost prompts.** The interviewer receives machine-generated observations you never see: you have been idle for five minutes, your custom run produced the wrong output, your submission failed on a hidden edge case. It reacts to what you *do*, not only to what you type in chat.
- **Token-by-token streaming** over Server-Sent Events, so replies appear as they are generated.
- **Explicit exits.** Navigating away from a live interview raises a three-way guard: stay, leave ungraded, or end and grade. Nothing about the session is kept in browser storage — the transcript lives in Redis and the session row in Postgres.

### The Judge

- **Five languages** — C, C++, Java, Python, JavaScript — each in its own Docker image.
- **Hardened sandboxes.** Every execution runs in a throwaway container with no network interface, a 256 MB memory cap, and a 3-second wall clock.
- **Sanitizer-backed verdicts.** C and C++ compile with AddressSanitizer and UndefinedBehaviorSanitizer in non-recovering mode, so out-of-bounds access and integer overflow surface as runtime errors instead of silently wrong answers. Interpreted languages promote warnings to errors.
- **Asynchronous evaluation** through a BullMQ queue with bounded concurrency, exponential-backoff retries, stalled-job recovery, and a rollback path if enqueueing fails after the row is written.
- **Run vs. Submit.** *Run* executes against your own stdin and caches the result in Redis without touching the database. *Submit* evaluates against hidden test cases and persists a verdict.
- **In-editor error-line highlighting.** A `Compilation Error` verdict (from either Run or Submit) is parsed against a per-language pattern to locate the offending line, which Monaco then highlights with a red background and gutter marker and scrolls into view. The highlight clears itself the moment you edit the code or the next run succeeds.

### Scoring

- **Four-pillar rubric** (100 points): data structure & algorithms, code quality and edge cases, communication and discovery, problem solving and speed.
- **Gamified ranks** from E-rank to S-rank, awarded per attempt rather than globally.
- **Per-problem leaderboards** sorted by score with earliest submission as the tie-breaker, showing each user's single best attempt.

---

## Architecture

```
                                  ┌──────────────────────────────┐
                                  │        Vercel (CDN)          │
                                  │  React 19 + Vite SPA         │
                                  │  Monaco Editor · AI Chatbox  │
                                  └──────────────┬───────────────┘
                                                 │
                        HTTPS (axios, withCredentials: true)
                        + Server-Sent Events (fetch ReadableStream)
                                                 │
                                                 ▼
     ┌───────────────────────────────────────────────────────────────────────┐
     │                       AWS EC2 Instance (Ubuntu)                       │
     │                                                                       │
     │   ┌──────────────────────────┐        ┌─────────────────────────┐     │
     │   │  Express 5 API Server    │        │   BullMQ Worker         │     │
     │   │  (Docker container)      │        │   (concurrency: 5)      │     │
     │   │                          │        │                         │     │
     │   │  auth · problems ·       │◀─────▶│   evaluate-code         │     │
     │   │  submissions · interviews│  jobs  │   run-code              │     │
     │   └───────┬──────────┬───────┘        └────────────┬────────────┘     │
     │           │          │                             │                  │
     │           │          │                  docker-cli │ (host socket)    │
     │           │          │                             ▼                  │
     │           │          │             ┌───────────────────────────┐      │
     │           │          │             │  Ephemeral Sandboxes      │      │
     │           │          │             │  gcc-alpine · corretto:21 │      │
     │           │          │             │  python:3.11 · node:20    │      │
     │           │          │             │  --network none           │      │
     │           │          │             │  --memory 256m · --rm     │      │
     │           │          │             └───────────────────────────┘      │
     └───────────┼──────────┼────────────────────────────────────────────────┘
                 │          │
     ┌───────────┘          └──────────────┬──────────────────────┐
     ▼                                     ▼                      ▼
┌───────────────┐                 ┌──────────────────┐   ┌──────────────────┐
│  Redis        │                 │  PostgreSQL      │   │  Google Gemini   │
│  BullMQ queue │                 │  (Supabase)      │   │  gemini-3.1-     │
│  chat cache   │                 │  Drizzle ORM     │   │  flash-lite      │
│  run results  │                 │                  │   │  (chat + grader) │
└───────────────┘                 └──────────────────┘   └──────────────────┘
```

The worker holds no execution logic of its own — it shells out to the **host's** Docker daemon via `docker-cli`, launching sibling containers rather than nesting a daemon inside itself. This is why every bind mount is expressed in host coordinates (`/home/ubuntu/app/temp/<uuid>`) even though the worker writes through its own container path (`/app/temp/<uuid>`).

---

## Tech Stack

| Layer | Technology |
| :---- | :---- |
| Frontend | React 19, Vite 8, React Router 7, TanStack Query, React Hook Form, Tailwind CSS 4 |
| Editor | Monaco Editor, react-markdown, remark-math, rehype-katex |
| Backend | Node.js 18+, Express 5 (ES Modules) |
| Database | PostgreSQL (Supabase), Drizzle ORM, drizzle-kit migrations |
| Queue & Cache | Redis, BullMQ, ioredis |
| Sandbox | Docker (gcc-alpine, amazoncorretto:21-alpine, python:3.11-slim, node:20-alpine) |
| AI | Google Gemini `gemini-3.1-flash-lite` via `@google/generative-ai` |
| Auth | JWT in HTTP-only cookies, bcrypt |
| Hosting | Vercel (frontend), AWS EC2 (API + worker), Supabase (database) |

---

## Repository Layout

```
online-judge/
├── backend/
│   └── src/
│       ├── database/
│       │   ├── schema.js              # Drizzle schema — tables, enums, indexes
│       │   ├── db_connector.js        # Connection pool + lifecycle helpers
│       │   └── drizzle-migrations/    # Versioned SQL migrations
│       ├── middlewares/
│       │   └── auth.middleware.js     # requireAuth, requireAdmin
│       ├── modules/
│       │   ├── auth/                  # Register, login, logout, verify
│       │   ├── problems/              # CRUD + dashboard status query
│       │   ├── submissions/           # Run, submit, status, leaderboard
│       │   └── interviews/            # Session, SSE chat, LLM, grading, cache
│       ├── queues/
│       │   └── submissionQueue.js     # BullMQ queue + Redis connection
│       ├── workers/
│       │   ├── submission.worker.js   # Job consumer
│       │   └── dockerEngine.js        # Language configs, compile & run
│       └── server.js                  # App bootstrap, CORS, graceful shutdown
├── frontend/
│   └── src/
│       ├── api/apiClient.js           # Axios instance with credentials
│       └── features/
│           ├── auth/                  # Login, register, route guard
│           ├── problems/              # Dashboard, Arena, editor, chatbox, timer
│           └── submissions/           # History, leaderboard
├── docs/
│   ├── HLD.md                         # V2 High-Level Design (current)
│   ├── HLD_V1.md                      # V1 High-Level Design (archived)
│   └── OJ_Project_V1_HLD.pdf
└── Dockerfile                         # Multi-stage backend image
```

---

## Getting Started

### Prerequisites

- Node.js 18 or newer
- Docker (running, with the daemon reachable by the current user)
- A PostgreSQL database (local or Supabase)
- A Redis instance (local or managed)
- A Google Gemini API key

### 1. Build the C/C++ sandbox image

C and C++ run in a locally built image tagged `gcc-alpine`. Create `Dockerfile.gcc`:

```dockerfile
# Start with the tiny 5MB Alpine Linux OS
FROM alpine:latest

# Install only the C compiler, C++ compiler, and standard math/C libraries
RUN apk add --no-cache gcc g++ musl-dev
```

Then build it under the tag the execution engine expects:

```bash
docker build -f Dockerfile.gcc -t gcc-alpine .
```

Pull the rest so the first submission is not slowed down by a cold fetch:

```bash
docker pull amazoncorretto:21-alpine
docker pull python:3.11-slim
docker pull node:20-alpine
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env        # then fill in the values — see below
npx drizzle-kit migrate     # apply migrations
npm run dev                 # nodemon on http://localhost:3000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                 # Vite on http://localhost:5173
```

The Vite dev server proxies `/api` to `localhost:3000`, so no frontend environment variable is needed locally.

---

## Environment Variables

Create `backend/.env`:

| Variable | Required | Description |
| :---- | :---- | :---- |
| `DATABASE_URL` | yes | PostgreSQL connection string. |
| `JWT_SECRET_KEY` | yes | Signing secret. Generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`. |
| `REDIS_URL` | yes | Redis connection string used by BullMQ and the interview cache. |
| `GEMINI_API_KEY` | yes | Google Gemini API key. |
| `PORT` | no | API port. Defaults to `3000`. |
| `NODE_ENV` | no | Set to `production` to enable `secure` + `sameSite: none` cookies. |

All four required variables are validated at startup — the process exits immediately rather than failing later with an opaque 500.

For a production frontend build, set `VITE_API_BASE_URL` in `frontend/.env.production` to your API origin.

---

## Database Migrations

Schema lives in `backend/src/database/schema.js` and is the single source of truth.

```bash
cd backend
npx drizzle-kit generate    # after editing schema.js
npx drizzle-kit migrate     # apply pending migrations
npx drizzle-kit studio      # browse the database
```

### Schema at a glance

| Table | Purpose |
| :---- | :---- |
| `users` | Accounts and RBAC role (`ADMIN` / `USER`). |
| `problems` | Statement, difficulty, constraints, sample test cases. |
| `test_cases` | Hidden test cases, cascade-deleted with the problem. |
| `submissions` | Code, language, verdict, error details, AI score, rank, score breakdown. |
| `interview_sessions` | One row per mock interview: transcript archive, timestamps, final submission link. |

`submissions.session_id` and `interview_sessions.submission_id` reference each other; both are nullable, so rows can be inserted in either order.

---

## API Reference

All routes require the JWT cookie except `POST /api/auth/register`, `POST /api/auth/login`, and `GET /`.

### Auth

| Method | Endpoint | Description |
| :---- | :---- | :---- |
| `POST` | `/api/auth/register` | Create an account and set the JWT cookie. |
| `POST` | `/api/auth/login` | Authenticate and set the JWT cookie. |
| `POST` | `/api/auth/logout` | Clear the cookie. |
| `GET` | `/api/auth/verify` | Validate the cookie, return the user payload. |

### Problems

| Method | Endpoint | Description |
| :---- | :---- | :---- |
| `GET` | `/api/problems/user-status` | All problems, annotated with the caller's best rank for each. |
| `GET` | `/api/problems/:id` | Statement, constraints, and sample test cases. |
| `POST` | `/api/problems` | **Admin.** Create a problem with its hidden test cases, transactionally. |
| `DELETE` | `/api/problems/:id` | **Admin.** Delete a problem and cascade its test cases. |

> **Note on the admin role.** There is no admin portal in the web app. The frontend never sends a `role`, so everyone who signs up through the UI is a `USER`. An admin is created by calling `POST /api/auth/register` directly from a terminal or an API client with `"role": "ADMIN"` in the body, and problems are authored the same way — by hitting the admin endpoints directly with that account's cookie. A first-class admin UI is on the roadmap.

### Submissions

| Method | Endpoint | Description |
| :---- | :---- | :---- |
| `POST` | `/api/submissions/run` | Queue a scratch run against custom stdin. Returns a `jobId`. |
| `GET` | `/api/submissions/run/:id/status` | Poll the Redis cache. `202` while still executing. |
| `POST` | `/api/submissions/submit` | Queue an official evaluation. Accepts an optional `sessionId`. |
| `GET` | `/api/submissions/:id/status` | Poll for the verdict and error details. |
| `GET` | `/api/submissions/me` | The caller's full submission history. |
| `GET` | `/api/submissions/problem/:problemId/me` | The caller's submissions for one problem. |
| `GET` | `/api/submissions/problem/:problemId/all` | Every user's submissions for one problem. |
| `GET` | `/api/submissions/leaderboard/problem/:problemId` | Rank-ordered leaderboard, best attempt per user. |

### Interviews

| Method | Endpoint | Description |
| :---- | :---- | :---- |
| `POST` | `/api/interviews/start` | Create a session, return the `sessionId`. |
| `POST` | `/api/interviews/chat` | SSE stream of the interviewer's reply. Rate limited to 6/min/IP. |
| `POST` | `/api/interviews/finish` | Snapshot, judge, grade, rank, and persist. Rate limited to 6/min/IP. |

### System

| Method | Endpoint | Description |
| :---- | :---- | :---- |
| `GET` | `/` | Health check. |

---

## Execution Sandbox

| Language | Image | Compile / Syntax check | Run |
| :---- | :---- | :---- | :---- |
| C | `gcc-alpine` | `gcc -fsanitize=address,undefined -fno-sanitize-recover=all -g -Wall -Werror` | `/app/main` |
| C++ | `gcc-alpine` | `g++ -fsanitize=address,undefined -fno-sanitize-recover=all -g -Wall -Werror` | `/app/main` |
| Java | `amazoncorretto:21-alpine` | `javac -Xlint:all -Werror` | `java Main` |
| Python | `python:3.11-slim` | `python -m py_compile` | `python -W error` |
| JavaScript | `node:20-alpine` | `node -c` | `node --use_strict --throw-deprecation` |

**Limits:** 256 MB memory (`--memory 256m --memory-swap 256m` — both are needed, or Docker grants an extra 256 MB of swap), 3 s execution, 10 s compilation, `--network none`, `--rm`.

Failures are classified by how the process died: a SIGTERM from the execution timeout is a **Time Limit Exceeded**, exit code 137 (the kernel's OOM killer) is a **Memory Limit Exceeded**, and any other non-zero exit is a **Runtime Error** with the trace preserved.

**Verdicts:** `Pending`, `Accepted`, `Compilation Error`, `Runtime Error`, `Time Limit Exceeded`, `Memory Limit Exceeded`, `Wrong Answer`, `Internal System Error`.

Wrong answers record the failing input alongside the expected and actual output, so the interviewer can point you at the edge case you missed without handing you the fix.

---

## Grading & Ranks

When an interview ends, the transcript and the final code go to Gemini in JSON mode with a strict rubric:

| Pillar | Points |
| :---- | :---- |
| Data structures & algorithms | 25 |
| Code quality & edge cases | 25 |
| Communication & discovery | 25 |
| Problem solving & speed | 25 |

Before grading, the *smart snapshot* step reconciles what you actually submitted. If your final editor contents match your last submission, that verdict is reused. If you kept typing — or never submitted at all — a new submission is queued and the request waits for a real verdict. No interview is ever graded against unjudged code.

| Score | Rank |
| :---- | :---- |
| 90–100 | S-rank |
| 80–89 | A-rank |
| 70–79 | B-rank |
| 60–69 | C-rank |
| 50–59 | D-rank |
| 0–49 | E-rank |

An empty or template-only submission is floored at 0. The UI shows only the tier; the raw score stays in the database as the leaderboard sort key.

---

## Deployment

**Frontend → Vercel.** `vercel.json` rewrites all paths to `index.html` for client-side routing. Set `VITE_API_BASE_URL` to your API origin.

**Backend + Worker → AWS EC2.** Build the multi-stage image from the repository root:

```bash
docker build -t online-judge-backend .
```

Push it to ECR, then run the stack on the instance with `docker-compose.yml`. The same image is started twice — once as the API server, once as the worker — alongside Redis:

```yaml
services:
  redis:
    image: redis:alpine
    restart: always

  api:
    image: <AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/my-oj-server/backend:latest
    command: npm run start
    ports:
      - "3000:3000"
    env_file: .env
    restart: always
    depends_on:
      - redis

  worker:
    image: <AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/my-oj-server/backend:latest
    command: node src/workers/submission.worker.js
    env_file: .env
    restart: always
    depends_on:
      - redis
    volumes:
      # This allows the worker to create compilers on the host
      - /var/run/docker.sock:/var/run/docker.sock
      - /home/ubuntu/app/temp:/app/temp
```

Only the worker mounts the Docker socket — the API server never launches containers. The two paths in that last volume are not interchangeable: the worker writes through `/app/temp` while instructing the host daemon to mount `/home/ubuntu/app/temp`. Changing one without the other will break every execution.

**Database → Supabase.** Apply migrations with `npx drizzle-kit migrate` before the first deploy.

**TLS.** The API must be served over HTTPS on its own subdomain. The auth cookie is issued with `secure: true` and `sameSite: "none"` in production, and browsers will silently drop it otherwise.

---

## Documentation

- **[docs/HLD.md](docs/HLD.md)** — the V2 High-Level Design: schema, endpoints, execution pipeline, AI engine, NFRs, deployment, roadmap.
- **[docs/HLD_V1.md](docs/HLD_V1.md)** — the original V1 design, kept for reference.

---

## Author

**Sukumar Thillairajan** — [github.com/SukumarThillairajan](https://github.com/SukumarThillairajan)
