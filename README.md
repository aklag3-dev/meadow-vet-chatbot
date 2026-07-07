# Meadow Vet Care — Virtual Assistant

AI-powered chatbot for Meadow Vet Care, an Irish veterinary clinic with 90+ services. Answers questions about services, pricing, availability, and special offers using live data from a Google Sheet.

## Features

- **Live data** — pulls services directly from a Google Sheet (auto-refreshes every 5 minutes)
- **8 MCP tools** — `get_services_by_species`, `search_services`, `get_services_with_offers`, `get_telehealth_services`, and more
- **Smart LLM** — Google AI Studio (Gemini) by default, compatible with OpenRouter, OpenAI, etc.
- **Demo mode** — works without an API key using keyword matching against live data
- **Clean UI** — modern chat interface styled after wellpets.ie

## Quick Start

```bash
npm install
cp .env.example .env.local
# Add your LLM_API_KEY to .env.local
npm run dev
# → http://localhost:3000
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_API_KEY` | _(empty)_ | Your Google AI Studio key ([get one here](https://aistudio.google.com/apikey)) |
| `LLM_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai` | LLM API endpoint |
| `LLM_MODEL` | `gemini-2.0-flash` | Model to use |

## MCP Tools

| Tool | Purpose |
|------|---------|
| `get_services_by_species` | All services for Dog, Cat, Rabbit, etc. |
| `get_services_by_category` | Services by type (Vaccination, Dental, etc.) |
| `get_services_with_offers` | Current promotions and discounts |
| `search_services` | Keyword search across service names |
| `get_price_range` | Services within a budget |
| `get_available_services` | Slots available this week |
| `get_telehealth_services` | Video consultation options |
| `get_clinic_summary` | High-level clinic overview |

## Tech Stack

- Next.js 14 (App Router)
- React 18
- Tailwind CSS
- TypeScript
- Google Sheets CSV API
