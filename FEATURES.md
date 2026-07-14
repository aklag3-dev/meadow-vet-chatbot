# Meadow Vet Care Chatbot — Feature Report

**Last updated:** 2026-07-15

---

## Overview

AI-powered customer chatbot for Meadow Vet Care (Carraroe, Co. Sligo) that answers questions about 94 veterinary services using live data from a Google Sheet, powered by Google AI Studio (Gemini) and a custom MCP (Model Context Protocol) tool architecture.

**Live:** https://meadow-vet-chatbot.vercel.app

---

## Original MCP Setup

### Core Architecture
- **LLM:** Google AI Studio — `gemini-2.5-flash`
- **Endpoint:** `https://generativelanguage.googleapis.com/v1beta/openai/`
- **Data source:** Google Sheet CSV (94 services across Dog, Cat, Rabbit, Small mammal, Bird)
- **Tool system:** Custom MCP tool definitions with agentic loop (up to 10 tool calls per message)

### Original MCP Tools (MVP)
| Tool | Description |
|------|-------------|
| `search_services` | Search services by species, category, price range, availability |
| `get_service_details` | Get details for a specific service by ID |
| `list_categories` | List all service categories for a species |
| `list_species` | List all species with service counts |
| `check_date` | Check if the clinic is open on a given date |
| `get_holidays` | Get upcoming Irish public holidays |
| `get_weather` | Get current weather + walking advice + EU/ROI disclaimer |

### Original API Integrations
| API | Purpose | Key Required |
|-----|---------|-------------|
| Google Sheets CSV | Service data (94 services, prices, availability) | No (public sheet) |
| Open-Meteo Weather | Temperature, wind, UV, precipitation, apparent temp | No |
| Open-Meteo Air Quality | European AQI, PM2.5, PM10, NO₂, O₃ | No |
| Tallyfy (via Google Sheets) | Irish public holidays 2025–2026 | No |

---

## New Features Added — P0/P1 MCP Tools

### 1. `get_local_pet_emergency_info` — Emergency Triage
- **Priority:** P0 (highest value, lowest effort)
- **What it does:** Time-aware emergency guidance with first-aid instructions for 7 symptom types (vomiting, bleeding, breathing difficulty, toxin ingestion, seizure, collapse, injury)
- **Time awareness:** Returns different phone numbers depending on whether the clinic is open (083 087 3030) or closed (083 087 3131)
- **Emergency fees:** Displays €100 consultation + €200 call out for after-hours
- **API:** Static knowledge base (no external API)

### 2. `get_pet_breed_info` — Breed Health Data
- **Priority:** P1
- **What it does:** Returns breed-specific health predispositions, temperament, lifespan, weight, and care advice
- **Dog breeds:** 340+ breeds via Dog API (`dogapi.dog/api/v2/breeds`)
- **Cat breeds:** 5 breeds (Persian, Maine Coon, Siamese, Bengal, British Shorthair) via knowledge base
- **Other species:** Rabbit and bird breed info from knowledge base
- **Health knowledge base:** 20 dog breeds + 5 cat breeds with common health issues (hip dysplasia, heart disease, eye conditions, etc.)
- **API:** Dog API by Kinduff (free, no key)

### 3. `get_nearby_emergency_vet` — Nearby Vet Search
- **Priority:** P1
- **What it does:** Finds veterinary clinics near the user's location using OpenStreetMap data
- **Always shows:** Meadow Vet Care as the primary result
- **Search radius:** Configurable (default 20km)
- **Distance calculation:** Haversine-based from user coords
- **API:** Overpass API (OpenStreetMap) — free, 10,000 req/day

### 4. `get_pollen_forecast` — Pollen & Allergy Data
- **Priority:** P1
- **What it does:** Returns pollen levels by type (grass, birch, alder, ragweed, mugwort) with severity ratings
- **Pet advice:** Tailored guidance for allergy-prone dogs and cats based on pollen levels
- **Breed-specific:** Extra warnings for brachycephalic breeds (pugs, bulldogs, Persians) when pollen + AQI are both high
- **API:** Open-Meteo Air Quality API (ECMWF CAMS) — free, no key

### 5. `get_vaccination_reminder` — Vaccination Schedules
- **Priority:** P1
- **What it does:** Species-specific vaccination schedules with next-due date calculation
- **Supports:** Dog (DHPP, Leptospirosis, Bordetella, Rabies), Cat (FVRCP, FeLV), Rabbit (Myxomatosis, RHDV)
- **Puppy/kitten courses:** Primary vaccination sequences for young pets
- **Overdue detection:** Flags overdue vaccinations with booking prompt
- **API:** Static knowledge base (no external API)

### 6. `get_driving_route` — Directions to Clinic
- **Priority:** P1
- **What it does:** Calculates driving/walking/cycling distance and ETA from user's location to Meadow Vet Care
- **Destination:** Tonafortes, Carraroe, Co. Sligo, F91 F895 (54.2787, -8.4818)
- **ETA guidance:** Contextual advice based on travel time (close, easy commute, consider calling ahead)
- **API:** OSRM (OpenStreetMap Routing Machine) — free, no key

---

## New APIs Integrated (P0/P1)

| API | Purpose | Endpoint | Key Required |
|-----|---------|----------|-------------|
| Dog API by Kinduff | Breed data (340+ breeds, weight, lifespan, temperament) | `dogapi.dog/api/v2/breeds` | No |
| Open-Meteo Air Quality | Pollen levels (grass, birch, alder, ragweed, mugwort) | `air-quality-api.open-meteo.com` | No |
| Overpass API | Nearby veterinary clinic search | `overpass-api.de/api/interpreter` | No (10k req/day) |
| OSRM | Driving/walking/cycling route calculation | `router.project-osrm.org/route/v1` | No |
| Nominatim | Geocoding (address → coordinates) | `nominatim.openstreetmap.org/search` | No (1 req/sec) |

---

## All APIs — Complete List

| API | Purpose | Key Required | Status |
|-----|---------|-------------|--------|
| Google Sheets CSV | Service data (94 services) | No | ✅ Live |
| Open-Meteo Weather | Weather forecast + UV | No | ✅ Live |
| Open-Meteo Air Quality | AQI + pollen levels | No | ✅ Live |
| Dog API by Kinduff | Breed information | No | ✅ Live |
| Overpass API | Nearby vet search | No | ✅ Live |
| OSRM | Route calculation | No | ✅ Live |
| Nominatim | Geocoding | No | ✅ Live |
| Tallyfy (Google Sheets) | Irish public holidays | No | ✅ Live |

---

## P2 Features (Not Yet Built)

These features were identified in the virtual user panel research (400 personas) as high-value but require additional infrastructure or third-party integrations.

### 1. `book_appointment` — Online Booking
- **Complexity:** High
- **What it would do:** Let users book appointments directly from chat
- **Requires:** Odoo API integration (https://www.odoo.com/app/appointments/6342047)
- **Needs:** Odoo instance URL, API token, user authentication (name + phone)
- **User need:** #2 pain point — "I want to book without calling"

### 2. `find_nearby_pet_services` — Pet-Friendly Places
- **Complexity:** Medium
- **What it would do:** Find parks, pet shops, groomers near user location
- **API:** Overpass API (already integrated, extend query)
- **User need:** #8 pain point — "Where can I take my dog near me?"

### 3. `find_pet_friendly_places` — Pet-Friendly Businesses
- **Complexity:** Medium
- **What it would do:** Find pet-friendly cafes, pubs, hotels, beaches
- **API:** Overpass API (extend tags: `dog`, `pet`, `animal`)
- **User need:** Tourists and locals looking for pet-friendly venues

### 4. `get_food_allergy_check` — Toxic Food Database
- **Complexity:** Low
- **What it would do:** Check if a food item is toxic to dogs/cats
- **API:** ASPCA Poison Control API (US-focused, phone-based) or static knowledge base
- **User need:** #4 pain point — "My dog ate chocolate, is it toxic?"

### 5. `get_service_comparison` — Compare Services
- **Complexity:** Low
- **What it would do:** Side-by-side comparison of similar services (e.g., full check-up vs mini check-up)
- **API:** Google Sheet data (already integrated)
- **User need:** Price transparency (#2 pain point)

### 6. `get_pet_passport_checker` — Travel Requirements
- **Complexity:** High
- **What it would do:** Check pet travel requirements for EU/UK destinations
- **API:** DEFRA/PET travel API (UK) or static knowledge base
- **User need:** Pet owners traveling with animals

### 7. `get_pet_allergy_alert` — Seasonal Allergy Alerts
- **Complexity:** Medium
- **What it would do:** Proactive alerts when pollen/mold counts are high for allergy-prone pets
- **API:** Open-Meteo Air Quality (already integrated)
- **User need:** #7 pain point — "When are allergies worst?"

### 8. `get_emergency_outside_area` — Emergency Vets Beyond Sligo
- **Complexity:** Medium
- **What it would do:** Find emergency vets when user is outside Meadow Vet Care's area
- **API:** Overpass API (already integrated, wider radius)
- **User need:** Traveling pet owners or users outside Sligo

### 9. `get_breed_comparison` — Compare Breeds
- **Complexity:** Low
- **What it would do:** Side-by-side breed comparison for prospective owners
- **API:** Dog API (already integrated)
- **User need:** First-time owners choosing a breed

### 10. `get_pet_insurance_guide` — Insurance Information
- **Complexity:** Low
- **What it would do:** General guidance on pet insurance options in Ireland
- **API:** Static knowledge base
- **User need:** New pet owners unaware of insurance options

---

## P3 Features (Future / Nice-to-Have)

These features were identified as lower priority or require significant infrastructure.

### 1. Multi-Language Support
- **What:** Irish (Gaeilge) language support for the chatbot
- **Complexity:** Medium
- **User need:** Irish-speaking community in Gaeltacht areas

### 2. Proactive Vaccination Reminders
- **What:** Push notifications or scheduled checks reminding users of upcoming vaccinations
- **Complexity:** High (requires user accounts, scheduling, notifications)
- **User need:** #5 pain point — "I forgot when my pet's booster is due"

### 3. Pet Health Records
- **What:** Store and retrieve pet vaccination history, test results, medications
- **Complexity:** High (requires database, user accounts, vet integration)
- **User need:** #9 pain point — "I can't find my pet's vaccination record"

### 4. Admin Dashboard
- **What:** Analytics on chatbot usage, common questions, conversion rates
- **Complexity:** Medium
- **Purpose:** Clinic can monitor and improve the chatbot

### 5. User Accounts
- **What:** Login system for personalised experiences (saved pets, vaccination history, preferences)
- **Complexity:** High (auth, database, session management)
- **Purpose:** Enables proactive features, personalisation

### 6. Feedback/Rating System
- **What:** Post-chat rating and feedback collection
- **Complexity:** Low
- **Purpose:** Measure chatbot effectiveness and identify improvement areas

### 7. Voice Input
- **What:** Speech-to-text for hands-free chatbot interaction
- **Complexity:** Medium (Web Speech API or third-party)
- **User need:** Elderly users or hands-free scenarios

### 8. WhatsApp Integration
- **What:** Deploy chatbot on WhatsApp Business API
- **Complexity:** High (Meta Business API, phone number verification)
- **User need:** WhatsApp is widely used in Ireland for business communication

### 9. Multi-Location Support
- **What:** Support for multiple Meadow Vet Care locations (if expanded)
- **Complexity:** Medium (location-aware routing, per-location data)
- **Purpose:** Future-proofing for business expansion

### 10. Symptom Triage AI
- **What:** More advanced symptom analysis with urgency scoring
- **Complexity:** High (medical knowledge base, liability considerations)
- **User need:** #1 pain point — "Is this an emergency?"

---

## Feature Priority Matrix

| Feature | Value | Effort | Priority | Status |
|---------|-------|--------|----------|--------|
| Emergency triage | 5 | 1 | P0 | ✅ Done |
| Breed health info | 4 | 2 | P1 | ✅ Done |
| Pollen forecast | 4 | 2 | P1 | ✅ Done |
| Vaccination reminders | 4 | 2 | P1 | ✅ Done |
| Nearby emergency vet | 3 | 2 | P1 | ✅ Done |
| Driving directions | 3 | 2 | P1 | ✅ Done |
| Online booking | 5 | 5 | P2 | ⏳ Pending |
| Pet-friendly places | 3 | 3 | P2 | ⏳ Pending |
| Toxic food checker | 4 | 2 | P2 | ⏳ Pending |
| Service comparison | 3 | 1 | P2 | ⏳ Pending |
| Pet passport checker | 3 | 4 | P2 | ⏳ Pending |
| Seasonal allergy alerts | 3 | 3 | P2 | ⏳ Pending |
| Multi-language | 3 | 3 | P3 | ⏳ Pending |
| Proactive reminders | 4 | 5 | P3 | ⏳ Pending |
| Pet health records | 4 | 5 | P3 | ⏳ Pending |
| Admin dashboard | 3 | 3 | P3 | ⏳ Pending |

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS |
| Backend | Next.js API Routes (serverless) |
| LLM | Google AI Studio — Gemini 2.5 Flash |
| Data | Google Sheets CSV (94 services) |
| Hosting | Vercel (auto-deploy from GitHub) |
| Repository | GitHub (public) |
| Tool system | Custom MCP architecture with agentic loop |
| Location | Browser Geolocation API + OpenStreetMap Nominatim |

---

## Commits

| Commit | Description |
|--------|-------------|
| `c3e1b63` | feat: add 6 MCP tools from user panel research |
| `f14f2c8` | fix: correct OSRM endpoint from /routing/v1/ to /route/v1/ |
| `94fc4e7` | feat: enhance weather with AQI, UV, wind gusts, EU/ROI compliance |
| `c938cb7` | feat: add location toggle to chat UI |
| `f892e04` | docs: add virtual user panel research report |
