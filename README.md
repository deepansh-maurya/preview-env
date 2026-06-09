# Preview Environments

Spin up isolated, live preview environments for every pull request — automatically. Every PR gets its own URL. When the PR closes, the environment is destroyed.

```
PR opened → Docker image built → subdomain routed → URL posted on PR → PR closed → environment destroyed
```

---

## How it works

1. You open a pull request on GitHub
2. GitHub sends a webhook to this service
3. The service builds a Docker image from your branch
4. A container is spun up and routed to `pr-{number}.preview.yourdomain.com` via Traefik
5. The live URL is posted as a comment on your PR automatically
6. Every new commit to the PR rebuilds and updates the same URL
7. When the PR is merged or closed, the container is stopped and the subdomain is removed

---

## Architecture

```
GitHub
  │
  │  webhook (PR opened / updated / closed)
  ▼
Express Backend
  │
  ├── Webhook verification (HMAC signature)
  ├── Job queue (Redis)
  │
  ▼
Background Worker
  │
  ├── git clone branch
  ├── docker build
  ├── docker run (isolated network)
  ├── register route with Traefik (dynamic config)
  ├── provision subdomain (DNS)
  └── post URL comment via GitHub API
  │
  ▼
Traefik Reverse Proxy
  │
  └── pr-47.preview.yourdomain.com → container:port

PostgreSQL
  └── environment state, build logs, PR metadata

Redis
  └── job queue, pub/sub for real-time build status
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Node + Express |
| Container runtime | Docker (via Docker SDK for Python) |
| Reverse proxy | Traefik (dynamic subdomain routing) |
| Database | PostgreSQL |
| Queue | Redis + ARQ |
| Frontend dashboard | Next.js |
| CI integration | GitHub Webhooks + GitHub API |
| Deployment | Docker Compose on a VPS |

---

## Getting started

### Prerequisites

- Docker and Docker Compose installed
- A domain with wildcard DNS configured (`*.preview.yourdomain.com → your server IP`)
- A GitHub App or webhook secret configured on your repo

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/preview-environments.git
cd preview-environments
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
# GitHub
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_APP_ID=your_app_id
GITHUB_PRIVATE_KEY_PATH=./github-app.pem

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/preview_envs

# Redis
REDIS_URL=redis://localhost:6379

# Domain
BASE_DOMAIN=preview.yourdomain.com

# Docker
DOCKER_NETWORK=preview_net
```

### 3. Start the services

```bash
docker compose up -d
```

This starts:
- Express backend (port 8000)
- Traefik reverse proxy (ports 80, 443, 8080 dashboard)
- PostgreSQL
- Redis
- Next.js dashboard (port 3000)

### 4. Configure GitHub webhook

In your GitHub repo → Settings → Webhooks → Add webhook:

```
Payload URL:   https://yourdomain.com/webhooks/github
Content type:  application/json
Secret:        your_webhook_secret (same as GITHUB_WEBHOOK_SECRET)
Events:        Pull requests
```

### 5. Open a pull request

That's it. Open a PR on your connected repo and watch the environment spin up. The bot will comment the preview URL within 2–3 minutes.

---

## Project structure

```
// will get updated 
preview-environments/
├── backend/
│   ├── main.py               # FastAPI app, webhook endpoint
│   ├── worker.py             # ARQ background worker
│   ├── docker_manager.py     # Docker SDK — build, run, stop containers
│   ├── traefik_manager.py    # Dynamic Traefik config generation
│   ├── github_client.py      # GitHub API — post comments, status checks
│   ├── dns_manager.py        # Subdomain provisioning
│   └── models.py             # SQLAlchemy models
├── dashboard/
│   ├── app/                  # Next.js app router
│   └── components/           # Environment cards, build logs, status
├── traefik/
│   ├── traefik.yml           # Static config
│   └── dynamic/              # Dynamic routing configs (auto-generated)
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Dashboard

The Next.js dashboard shows:

- All running preview environments with their URLs
- Build status and logs per environment (real-time via WebSocket)
- Resource usage per container (CPU, memory)
- PR metadata — branch, author, last commit
- One-click environment teardown

Access it at `http://localhost:3000` or your configured domain.

---

## Environment isolation

Each preview environment runs in:

- Its own Docker container with resource limits (512MB RAM, 0.5 CPU by default)
- An isolated Docker network — containers cannot talk to each other
- Its own PostgreSQL schema — no shared database state between previews
- A unique subdomain — `pr-{number}.preview.yourdomain.com`

---

## Configuration

### Resource limits per environment

In `.env`:

```env
ENV_MEMORY_LIMIT=512m
ENV_CPU_LIMIT=0.5
ENV_STORAGE_LIMIT=2g
```

### Max concurrent environments

```env
MAX_CONCURRENT_ENVS=10
```

Environments beyond this limit are queued. Oldest idle environments are stopped first.

### Environment TTL

Environments are automatically stopped after inactivity:

```env
ENV_IDLE_TIMEOUT_HOURS=24
```

---

## How Traefik routing works

When a new environment is created, the worker writes a dynamic configuration file to `traefik/dynamic/pr-{number}.yml`:

```yaml
http:
  routers:
    pr-47:
      rule: "Host(`pr-47.preview.yourdomain.com`)"
      service: pr-47
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt

  services:
    pr-47:
      loadBalancer:
        servers:
          - url: "http://container_ip:3000"
```

Traefik watches this directory and picks up changes without restarting. When the environment is destroyed, the file is deleted and the route disappears.

---

## GitHub bot comments

When an environment is ready, the bot posts:

```
🚀 Preview environment ready

Branch:   feature/user-auth
Commit:   a3f9c21
Built in: 1m 43s

🔗 https://pr-47.preview.yourdomain.com

This environment will be automatically removed when the PR is closed.
```

When the PR is closed:

```
🧹 Preview environment removed

Environment for pr-47 has been stopped and cleaned up.
```

---

## Local development

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Worker (separate terminal)
python -m arq worker.WorkerSettings

# Dashboard
cd dashboard
npm install
npm run dev
```

Use [ngrok](https://ngrok.com) to expose your local backend to GitHub webhooks during development:

```bash
ngrok http 8000
# Use the ngrok URL as your GitHub webhook Payload URL
```

---

## Roadmap

- [ ] Multi-repo support
- [ ] Custom build commands per repo (read from `.preview.yml` in repo root)
- [ ] Slack and Discord notifications
- [ ] Usage analytics — build times, environment lifespan, resource consumption
- [ ] Team access controls
- [ ] Support for monorepos — spin up only affected services

---

## Why I built this

Preview environments are a core part of how modern product teams ship — Vercel has them for Next.js, Railway has them, Netlify has them. But they're tightly coupled to specific platforms. This is a self-hosted, platform-agnostic version that works with any Dockerised application. Built to understand the full stack: webhooks, container orchestration, dynamic DNS routing, async job processing, and real-time dashboards.

---

## License

MIT
