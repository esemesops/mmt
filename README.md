# MMT

OpenAI-compatible AI gateway for MTN Music Trivia.

MMT receives a music trivia question with option `A` and option `B`, searches for compact evidence, asks an LLM through OpenRouter, and returns a strict `A` or `B` answer. The API is designed to be deployed on Railway and to grow into a small user/admin control plane for API key management, usage limits, and analytics.

## Architecture

- `apps/api`: NestJS API ingress.
- OpenAI-compatible route: `POST /v1/chat/completions`.
- Native trivia route: `POST /v1/trivia/answer`.
- Search provider: SearXNG by default for local and production.
- Brave Search API adapter is available behind `SEARCH_PROVIDER=brave` for a future switch.
- LLM gateway: LiteLLM proxy.
- Default LLM provider behind LiteLLM: OpenRouter Gemini Flash Lite.
- Redis: repeated-question and search-result caching.
- Postgres: ready for request logs, users, plans, and API key management.

## Local Development

```bash
cp .env.example .env
pnpm install
docker compose up -d postgres redis searxng
pnpm dev
```

API runs on `http://localhost:4000`.
Swagger docs run on `http://localhost:4000/docs`.
LiteLLM proxy runs on `http://localhost:4001`.

For full local stack testing, set `OPENROUTER_API_KEY` in `.env` and run:

```bash
docker compose up -d
```

## Search Providers

MMT uses SearXNG by default:

```env
SEARCH_PROVIDER=searxng
SEARXNG_BASE_URL=http://searxng:8080
```

The Brave adapter is already implemented but opt-in:

```env
SEARCH_PROVIDER=brave
BRAVE_SEARCH_API_KEY=...
```

Do not deploy Brave by default. We will switch only if SearXNG proves too unreliable for production traffic.

## Example

```bash
curl -sS http://localhost:4000/v1/trivia/answer \
  -H "content-type: application/json" \
  -H "authorization: Bearer dev_mmt_key" \
  -d '{
    "question": "Who released Thriller?",
    "options": { "A": "Michael Jackson", "B": "Prince" }
  }'
```
