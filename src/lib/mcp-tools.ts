// MCP Tool definitions for Meadow Vet Care
// These tools are exposed to the LLM for live data access

import { fetchServices, formatPrice, VetService } from './sheets';
import { fetchIrishHolidays, isPublicHoliday, isClosed, getNextHoliday, getHolidaySummary } from './holidays';
import { getCurrentWeather, isGoodForWalkingPet, formatWeatherReport, getWeatherDisclaimer } from './weather';
import { getBreedInfo } from './breed-info';

export interface MCPTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  handler: (input: Record<string, unknown>) => Promise<string>;
}

function filterServices(services: VetService[], filters: {
  species?: string;
  category?: string;
  max_price?: number;
  has_offer?: boolean;
  available_now?: boolean;
  name_contains?: string;
}): VetService[] {
  return services.filter(s => {
    if (filters.species && !s.species.toLowerCase().includes(filters.species.toLowerCase())) return false;
    if (filters.category && !s.category.toLowerCase().includes(filters.category.toLowerCase())) return false;
    if (filters.max_price && s.price_eur > filters.max_price * 100) return false;
    if (filters.has_offer && !s.special_offer) return false;
    if (filters.available_now && s.slots_this_week === 0) return false;
    if (filters.name_contains && !s.service_name.toLowerCase().includes(filters.name_contains.toLowerCase())) return false;
    return true;
  });
}

function formatServiceList(services: VetService[]): string {
  if (services.length === 0) return 'No services found matching your criteria.';

  const grouped: Record<string, VetService[]> = {};
  for (const s of services) {
    const key = `${s.species} - ${s.category}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  }

  let output = `Found ${services.length} service(s):\n\n`;
  for (const [key, group] of Object.entries(grouped)) {
    output += `**${key}:**\n`;
    for (const s of group) {
      const offer = s.special_offer ? ` ★ ${s.special_offer}` : '';
      const slots = s.slots_this_week > 0 ? `${s.slots_this_week} slots this week` : 'No slots this week';
      output += `  - ${s.service_name}: ${formatPrice(s.price_eur)} | ${s.duration_min}min | ${slots}${offer}\n`;
    }
    output += '\n';
  }
  return output;
}

export function getMCPTools(): MCPTool[] {
  return [
    {
      name: 'get_services_by_species',
      description: 'Get all veterinary services available for a specific species (Dog, Cat, Rabbit, Small mammal, Bird). Returns service names, prices, duration, availability, and any special offers.',
      input_schema: {
        type: 'object',
        properties: {
          species: { type: 'string', description: 'The species: Dog, Cat, Rabbit, Small mammal, or Bird' },
        },
        required: ['species'],
      },
      handler: async (input) => {
        const services = await fetchServices();
        const filtered = filterServices(services, { species: input.species as string });
        return formatServiceList(filtered);
      },
    },
    {
      name: 'get_services_by_category',
      description: 'Get all services in a category (Consultation, Preventive, Vaccination, Dental, Surgery, Grooming, Diagnostics, Nutrition, Microchip & ID, Behaviour, Emergency, End-of-life).',
      input_schema: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'The service category' },
          species: { type: 'string', description: 'Optional: filter by species' },
        },
        required: ['category'],
      },
      handler: async (input) => {
        const services = await fetchServices();
        const filtered = filterServices(services, {
          category: input.category as string,
          species: input.species as string | undefined,
        });
        return formatServiceList(filtered);
      },
    },
    {
      name: 'get_services_with_offers',
      description: 'Get all services that currently have special offers, discounts, or promotions. Returns offer details alongside service info.',
      input_schema: {
        type: 'object',
        properties: {
          species: { type: 'string', description: 'Optional: filter by species' },
        },
        required: [],
      },
      handler: async (input) => {
        const services = await fetchServices();
        const filtered = filterServices(services, {
          has_offer: true,
          species: input.species as string | undefined,
        });
        return formatServiceList(filtered);
      },
    },
    {
      name: 'search_services',
      description: 'Search for services by name or keyword. Use this for specific queries like "microchipping", "dental", "neutering", etc.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search term to match against service names' },
          species: { type: 'string', description: 'Optional: filter by species' },
        },
        required: ['query'],
      },
      handler: async (input) => {
        const services = await fetchServices();
        const filtered = filterServices(services, {
          name_contains: input.query as string,
          species: input.species as string | undefined,
        });
        return formatServiceList(filtered);
      },
    },
    {
      name: 'get_price_range',
      description: 'Get services within a price range. Prices are in euros. Use this for budget queries like "what costs under €50?"',
      input_schema: {
        type: 'object',
        properties: {
          max_price: { type: 'number', description: 'Maximum price in euros' },
          min_price: { type: 'number', description: 'Optional minimum price in euros' },
          species: { type: 'string', description: 'Optional: filter by species' },
        },
        required: ['max_price'],
      },
      handler: async (input) => {
        const services = await fetchServices();
        let filtered = filterServices(services, {
          max_price: input.max_price as number,
          species: input.species as string | undefined,
        });
        if (input.min_price) {
          filtered = filtered.filter(s => s.price_eur >= (input.min_price as number) * 100);
        }
        return formatServiceList(filtered);
      },
    },
    {
      name: 'get_available_services',
      description: 'Get services that have appointment slots available this week.',
      input_schema: {
        type: 'object',
        properties: {
          species: { type: 'string', description: 'Optional: filter by species' },
          category: { type: 'string', description: 'Optional: filter by category' },
        },
        required: [],
      },
      handler: async (input) => {
        const services = await fetchServices();
        const filtered = filterServices(services, {
          available_now: true,
          species: input.species as string | undefined,
          category: input.category as string | undefined,
        });
        return formatServiceList(filtered);
      },
    },
    {
      name: 'get_telehealth_services',
      description: 'Get all telehealth / video consultation services available at the clinic.',
      input_schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async () => {
        const services = await fetchServices();
        const filtered = services.filter(s =>
          s.service_name.toLowerCase().includes('telehealth') ||
          s.service_name.toLowerCase().includes('video')
        );
        return formatServiceList(filtered);
      },
    },
    {
      name: 'get_clinic_summary',
      description: 'Get a high-level summary of the clinic: total services, species served, categories, price range, and current promotions.',
      input_schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async () => {
        const services = await fetchServices();
        const species = [...new Set(services.map(s => s.species))];
        const categories = [...new Set(services.map(s => s.category))];
        const prices = services.map(s => s.price_eur);
        const offers = services.filter(s => s.special_offer);

        return `Meadow Vet Care Summary:
- Total services: ${services.length}
- Species: ${species.join(', ')}
- Categories: ${categories.join(', ')}
- Price range: ${formatPrice(Math.min(...prices))} - ${formatPrice(Math.max(...prices))}
- Services with current offers: ${offers.length}
- Emergency services: Available 24/7
- Telehealth: Available for all species`;
      },
    },
    {
      name: 'check_date',
      description: 'Check if the clinic is open on a specific date. Use this when asked about opening hours, whether the clinic is open on a particular day, or holiday closures.',
      input_schema: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date to check in YYYY-MM-DD format' },
        },
        required: ['date'],
      },
      handler: async (input) => {
        const dateStr = input.date as string;
        const { closed, reason } = await isClosed(dateStr);
        const { isHoliday, holiday } = await isPublicHoliday(dateStr);

        if (closed) {
          return `The clinic is CLOSED on ${dateStr}. Reason: ${reason}`;
        }

        let result = `The clinic is OPEN on ${dateStr}.`;
        if (isHoliday) {
          result += `\nNote: ${holiday!.name} is a public holiday, but the clinic remains open on this date.`;
        }

        const nextHoliday = await getNextHoliday();
        if (nextHoliday) {
          result += `\nNext upcoming holiday: ${nextHoliday.name} on ${nextHoliday.observed_date}.`;
        }

        return result;
      },
    },
    {
      name: 'get_holidays',
      description: 'Get all Irish public holidays for the current year. Use this when asked about holidays, bank holidays, or when the clinic is closed.',
      input_schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async () => {
        return await getHolidaySummary();
      },
    },
    {
      name: 'get_weather',
      description: 'Get current weather conditions in Sligo, Ireland, including temperature (actual and feels-like), wind speed and gusts, UV index, and air quality data. Includes walking suitability advice for pets. IMPORTANT: Always clarify that this weather data is for Sligo and surrounding areas only. If the user is not nearby, ask them to provide their location for more accurate information.',
      input_schema: {
        type: 'object',
        properties: {
          latitude: { type: 'number', description: 'Optional: latitude for custom location. Default is Sligo (54.2766).' },
          longitude: { type: 'number', description: 'Optional: longitude for custom location. Default is Sligo (-8.5783).' },
          location_name: { type: 'string', description: 'Optional: name of the location for display purposes.' },
        },
        required: [],
      },
      handler: async (input) => {
        const lat = (input.latitude as number) || 54.2766;
        const lon = (input.longitude as number) || -8.5783;
        const locationName = (input.location_name as string) || 'Sligo, Ireland';

        const weather = await getCurrentWeather(lat, lon, locationName);
        const report = formatWeatherReport(weather);
        const walking = isGoodForWalkingPet(weather);
        const disclaimer = getWeatherDisclaimer();

        let result = report;
        result += `\n\nWalking advice: ${walking.advice}`;
        result += `\n\n⚠️ Weather data is for ${locationName} and surrounding areas only. If you are not nearby, please share your location for a more accurate assessment.`;
        result += `\n\n${disclaimer}`;

        return result;
      },
    },
    {
      name: 'get_local_pet_emergency_info',
      description: 'Get emergency veterinary information for Meadow Vet Care. Returns the correct phone number based on whether the clinic is currently open or closed, first-aid guidance for common pet emergencies, and urgency assessment. ALWAYS call this tool for any emergency question — symptoms, accidents, toxin ingestion, breathing difficulty, seizures, or bleeding.',
      input_schema: {
        type: 'object',
        properties: {
          symptom: { type: 'string', description: 'The symptom or emergency type: vomiting, bleeding, breathing_difficulty, toxin_ingestion, seizure, collapse, injury, other' },
        },
        required: [],
      },
      handler: async (input) => {
        const now = new Date();
        const hour = now.getHours();
        const minutes = now.getMinutes();
        const day = now.getDay();
        const isWeekday = day >= 1 && day <= 5;
        const isOpen = isWeekday && (hour > 9 || (hour === 9 && minutes >= 0)) && (hour < 17 || (hour === 17 && minutes === 0));
        const symptom = (input.symptom as string)?.toLowerCase() || '';

        let response = '';

        if (isOpen) {
          response += `Meadow Vet Care is currently OPEN.\n`;
          response += `Reception: 083 087 3030 (call now)\n`;
          response += `Address: Tonafortes, Carraroe, Co. Sligo, F91 F895\n\n`;
        } else {
          response += `Meadow Vet Care is currently CLOSED (after hours).\n`;
          response += `EMERGENCY LINE: 083 087 3131 (call NOW)\n`;
          response += `Emergency fees: €100 consultation + €200 call out fee\n`;
          response += `Address: Tonafortes, Carraroe, Co. Sligo, F91 F895\n\n`;
        }

        // First-aid guidance by symptom
        const firstAid: Record<string, string> = {
          vomiting: '**Vomiting guidance:**\n- Withhold food for 12 hours, then offer small bland meals (boiled chicken + rice).\n- Ensure fresh water is always available.\n- If vomiting is persistent (more than 3 times), contains blood, or is accompanied by lethargy/diarrhoea — seek veterinary care immediately.\n- Do NOT give human medications (ibuprofen, paracetamol are toxic to pets).',
          bleeding: '**Bleeding guidance:**\n- Apply firm, direct pressure with a clean cloth for 10-15 minutes.\n- Do NOT remove the cloth if blood soaks through — add more on top.\n- For limb bleeding: elevate above the heart if possible.\n- For severe or arterial bleeding (bright red, pulsing) — seek emergency care IMMEDIATELY.\n- Do NOT apply tourniquets unless trained.',
          breathing_difficulty: '**Breathing difficulty guidance:**\n- Keep the pet calm and still.\n- Ensure airways are clear — check for obstructions in mouth.\n- If breathing is laboured (abdominal breathing, blue gums, open-mouth breathing) — this is a EMERGENCY. Call 083 087 3131 now.\n- Do NOT force water or food.',
          toxin_ingestion: '**Toxin ingestion guidance:**\n- Identify what was eaten and how much if possible.\n- Do NOT induce vomiting unless specifically instructed by a vet.\n- Common toxins: chocolate, grapes/raisins, xylitol (sugar-free products), onions, lilies (cats), antifreeze, medications.\n- Bring the packaging/container to the vet if possible.\n- Call the clinic immediately — time is critical.',
          seizure: '**Seizure guidance:**\n- Move the pet away from stairs, furniture, or dangerous objects.\n- Time the seizure — if it lasts more than 5 minutes, call the emergency line immediately.\n- Do NOT restrain the pet or put anything in its mouth.\n- Keep the environment quiet and dim.\n- After the seizure, the pet may be disoriented — keep them calm and safe.',
          collapse: '**Collapse guidance:**\n- Keep the pet still and calm.\n- Check breathing and pulse.\n- If unconscious: ensure airway is clear, check breathing.\n- This is an emergency — call the emergency line immediately.\n- Transport carefully, supporting the body.',
          injury: '**Injury guidance:**\n- Assess the injury from a safe distance — injured pets may bite.\n- For fractures: immobilise the limb, do not attempt to reset.\n- For wounds: gently clean with warm water, apply light dressing.\n- Keep the pet warm and calm.\n- Seek veterinary care as soon as possible.',
        };

        if (symptom && firstAid[symptom]) {
          response += `**First-aid steps:**\n${firstAid[symptom]}\n\n`;
        } else if (symptom) {
          response += `For the symptom "${symptom}" — call the clinic for specific guidance.\n\n`;
        }

        if (isOpen) {
          response += `**Important:** I am an AI assistant, not a vet. Please describe your pet's symptoms to the reception team who can advise on urgency and book an appointment.`;
        } else {
          response += `**Important:** I am an AI assistant, not a vet. For after-hours emergencies, call 083 087 3131 immediately. Describe your pet's symptoms clearly to the emergency vet.`;
        }

        return response;
      },
    },
    {
      name: 'get_pet_breed_info',
      description: 'Get breed-specific health information, care advice, and common predispositions for dogs, cats, rabbits, and birds. Use when the user mentions their pet\'s breed or asks about breed-specific health concerns. For dogs, provides data from 340+ breeds via the Dog API.',
      input_schema: {
        type: 'object',
        properties: {
          species: { type: 'string', description: 'The pet species: dog, cat, rabbit, bird, or small mammal' },
          breed: { type: 'string', description: 'Optional: specific breed name (e.g., "Golden Retriever", "Persian", "Holland Lop")' },
        },
        required: ['species'],
      },
      handler: async (input) => {
        const species = input.species as string;
        const breed = input.breed as string | undefined;
        const info = await getBreedInfo(species, breed);

        let result = `**${info.name}**\n`;
        if (info.lifespan) result += `- Typical lifespan: ${info.lifespan}\n`;
        if (info.temperament) result += `- Temperament: ${info.temperament}\n`;
        if (info.bred_for) result += `- Bred for: ${info.bred_for}\n`;
        if (info.breed_group) result += `- Breed group: ${info.breed_group}\n`;
        if (info.weight_kg) result += `- Weight: ${info.weight_kg} kg\n`;
        if (info.height_cm) result += `- Height: ${info.height_cm} cm\n`;
        result += `\n**Common health issues:**\n`;
        for (const issue of info.health_issues) {
          result += `- ${issue}\n`;
        }
        result += `\n**Care advice:** ${info.health_advice}\n`;
        result += `\n💡 Meadow Vet Care offers breed-specific health checks and screenings. Book a consultation to discuss your ${info.species.toLowerCase()}'s health needs.`;
        return result;
      },
    },
    {
      name: 'get_nearby_emergency_vet',
      description: 'Find the nearest emergency veterinary clinics to the user\'s location using OpenStreetMap data. Returns Meadow Vet Care details plus any other emergency vets found nearby. Use when the user asks about emergency vets or is outside Meadow Vet Care\'s usual area.',
      input_schema: {
        type: 'object',
        properties: {
          latitude: { type: 'number', description: 'User latitude (defaults to Sligo)' },
          longitude: { type: 'number', description: 'User longitude (defaults to Sligo)' },
          radius_km: { type: 'number', description: 'Search radius in km (default 20)' },
        },
        required: [],
      },
      handler: async (input) => {
        const lat = (input.latitude as number) || 54.2766;
        const lon = (input.longitude as number) || -8.5783;
        const radius = (input.radius_km as number) || 20;

        let result = `**Emergency Vet — Meadow Vet Care** (nearest)\n`;
        result += `- Address: Tonafortes, Carraroe, Co. Sligo, F91 F895\n`;
        result += `- Reception (9-5, Mon-Fri): 083 087 3030\n`;
        result += `- Emergency (after hours): 083 087 3131\n`;
        result += `- Emergency fees: €100 consultation + €200 call out\n\n`;

        try {
          // Overpass API query for emergency vets within radius
          const radiusM = radius * 1000;
          const query = `
            [out:json][timeout:10];
            (
              node["amenity"="veterinary"]["emergency"="yes"](around:${radiusM},${lat},${lon});
              way["amenity"="veterinary"]["emergency"="yes"](around:${radiusM},${lat},${lon});
              node["amenity"="veterinary"](around:${radiusM},${lat},${lon});
              way["amenity"="veterinary"](around:${radiusM},${lat},${lon});
            );
            out center;
          `;

          const res = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `data=${encodeURIComponent(query)}`,
          });

          if (res.ok) {
            const data = await res.json();
            const elements = data.elements || [];

            if (elements.length > 0) {
              result += `**Other veterinary clinics in the area:**\n`;
              let count = 0;
              for (const el of elements) {
                const name = el.tags?.name;
                if (!name) continue;
                const addr = [el.tags?.['addr:street'], el.tags?.['addr:housename'], el.tags?.['addr:city']].filter(Boolean).join(', ');
                const phone = el.tags?.phone || el.tags?.['contact:phone'] || '';
                const emergency = el.tags?.emergency === 'yes' ? ' ⚡ Emergency' : '';
                const elLat = el.lat || el.center?.lat;
                const elLon = el.lon || el.center?.lon;
                let dist = '';
                if (elLat && elLon) {
                  const dLat = (elLat - lat) * 111;
                  const dLon = (elLon - lon) * 111 * Math.cos(lat * Math.PI / 180);
                  dist = ` (~${Math.round(Math.sqrt(dLat * dLat + dLon * dLon))}km)`;
                }
                result += `- ${name}${emergency}${dist}`;
                if (addr) result += ` — ${addr}`;
                if (phone) result += ` | ${phone}`;
                result += '\n';
                count++;
                if (count >= 5) break;
              }
            }
          }
        } catch (err) {
          result += `(Unable to search for nearby clinics right now — try again later)\n`;
        }

        return result;
      },
    },
    {
      name: 'get_pollen_forecast',
      description: 'Get pollen forecast for the user\'s location. Returns pollen levels by type (grass, birch, alder, ragweed, mugwort) with severity ratings and advice for pets with seasonal allergies. Data from Open-Meteo Air Quality API (free, no key).',
      input_schema: {
        type: 'object',
        properties: {
          latitude: { type: 'number', description: 'User latitude (defaults to Sligo)' },
          longitude: { type: 'number', description: 'User longitude (defaults to Sligo)' },
        },
        required: [],
      },
      handler: async (input) => {
        const lat = (input.latitude as number) || 54.2766;
        const lon = (input.longitude as number) || -8.5783;

        try {
          const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,ragweed_pollen&timezone=Europe/Dublin`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Air quality API error: ${res.status}`);
          const data = await res.json();
          const current = data.current;

          if (!current) return 'Pollen data is currently unavailable for your location.';

          const pollenTypes = [
            { name: 'Grass', value: current.grass_pollen, unit: 'grains/m³' },
            { name: 'Birch', value: current.birch_pollen, unit: 'grains/m³' },
            { name: 'Alder', value: current.alder_pollen, unit: 'grains/m³' },
            { name: 'Ragweed', value: current.ragweed_pollen, unit: 'grains/m³' },
            { name: 'Mugwort', value: current.mugwort_pollen, unit: 'grains/m³' },
          ];

          function getPollenSeverity(val: number): string {
            if (val <= 5) return '🟢 Low';
            if (val <= 15) return '🟡 Moderate';
            if (val <= 30) return '🟠 High';
            return '🔴 Very High';
          }

          let result = `**Pollen Forecast**\n\n`;
          for (const p of pollenTypes) {
            result += `- ${p.name}: ${p.value} ${p.unit} ${getPollenSeverity(p.value)}\n`;
          }

          const maxPollen = Math.max(...pollenTypes.map(p => p.value));
          result += `\n`;
          if (maxPollen > 30) {
            result += `⚠️ **Very high pollen levels** — keep allergy-prone pets indoors where possible. Wipe paws after walks. Cats with respiratory issues should stay inside.\n`;
          } else if (maxPollen > 15) {
            result += `⚠️ **Moderate to high pollen** — pets with allergies may need shorter walks. Wipe paws and coat after outdoor time.\n`;
          } else if (maxPollen > 5) {
            result += `✅ **Low to moderate pollen** — generally safe for most pets. Sensitive animals may still react.\n`;
          } else {
            result += `✅ **Low pollen** — good conditions for pets with allergies.\n`;
          }

          result += `\nData: Open-Meteo Air Quality API (ECMWF CAMS). Not official Met Éireann data.`;
          return result;
        } catch (err) {
          return 'Pollen data is currently unavailable. Please try again later.';
        }
      },
    },
    {
      name: 'get_vaccination_reminder',
      description: 'Get the recommended vaccination schedule for a pet based on species and breed. Calculates when the next booster is due based on the last vaccination date. Use when users ask about vaccinations, boosters, or when their pet needs their jabs.',
      input_schema: {
        type: 'object',
        properties: {
          species: { type: 'string', description: 'Pet species: dog, cat, rabbit' },
          breed: { type: 'string', description: 'Optional: specific breed for tailored advice' },
          last_vaccination_date: { type: 'string', description: 'Optional: ISO date (YYYY-MM-DD) of last vaccination' },
          pet_age_months: { type: 'number', description: 'Optional: pet age in months (for puppy/kitten primary course)' },
        },
        required: ['species'],
      },
      handler: async (input) => {
        const species = (input.species as string).toLowerCase();
        const lastDate = input.last_vaccination_date as string | undefined;
        const petAgeMonths = input.pet_age_months as number | undefined;

        let result = '';
        const now = new Date();

        if (species === 'dog') {
          result += `**Dog Vaccination Schedule**\n\n`;
          if (petAgeMonths && petAgeMonths < 16) {
            result += `**Puppy Primary Course:**\n`;
            result += `- 8 weeks: 1st DHPP (Distemper, Hepatitis, Parainfluenza, Parvovirus)\n`;
            result += `- 12 weeks: 2nd DHPP\n`;
            result += `- 16 weeks: 3rd DHPP + Leptospirosis\n`;
            result += `- 1 year: DHPP booster + Leptospirosis booster\n\n`;
          }
          result += `**Annual Boosters:**\n`;
          result += `- DHPP: every 1-3 years (depending on vet protocol)\n`;
          result += `- Leptospirosis: annually (especially in rural/field areas)\n`;
          result += `- Bordetella (kennel cough): annually or before boarding\n`;
          result += `- Rabies: every 3 years (if traveling)\n\n`;
          result += `**Non-core (lifestyle):**\n`;
          result += `- Canine influenza: if boarding/socialising regularly\n`;
          result += `- Lyme disease: if in tick-heavy areas\n`;
        } else if (species === 'cat') {
          result += `**Cat Vaccination Schedule**\n\n`;
          if (petAgeMonths && petAgeMonths < 16) {
            result += `**Kitten Primary Course:**\n`;
            result += `- 9 weeks: 1st FVRCP (Cat flu, FeLV)\n`;
            result += `- 12 weeks: 2nd FVRCP + FeLV\n`;
            result += `- 16 weeks: 3rd FVRCP + FeLV booster\n`;
            result += `- 1 year: FVRCP booster + FeLV booster\n\n`;
          }
          result += `**Annual Boosters:**\n`;
          result += `- FVRCP (feline flu): annually\n`;
          result += `- FeLV (leukaemia): annually for outdoor cats\n\n`;
          result += `**Non-core:**\n`;
          result += `- Rabies: if traveling\n`;
          result += `- FIV: not currently available in Ireland\n`;
        } else if (species === 'rabbit') {
          result += `**Rabbit Vaccination Schedule**\n\n`;
          result += `- 5-7 weeks: 1st Myxomatosis + RHDV\n`;
          result += `- 10-12 weeks: 2nd Myxomatosis + RHDV\n`;
          result += `- 4 months: RHDV booster\n`;
          result += `- Annually: Myxomatosis + RHDV1 + RHDV2\n\n`;
          result += `**Critical:** Myxomatosis and RHDV are fatal. Vaccination is essential for all rabbits with outdoor access.\n`;
        } else {
          result += `Species-specific vaccination schedules are not available for ${species}. Please consult the clinic for advice.\n`;
        }

        // Calculate next due date
        if (lastDate) {
          const last = new Date(lastDate);
          if (!isNaN(last.getTime())) {
            const nextAnnual = new Date(last);
            nextAnnual.setFullYear(nextAnnual.getFullYear() + 1);
            const monthsUntil = Math.round((nextAnnual.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30));

            result += `\n**Your pet's next vaccination:**\n`;
            result += `- Last vaccination: ${lastDate}\n`;
            result += `- Next due: ${nextAnnual.toISOString().split('T')[0]}\n`;
            if (monthsUntil > 0) {
              result += `- Time until due: ~${monthsUntil} months\n`;
            } else {
              result += `- ⚠️ **OVERDUE** — please book an appointment as soon as possible\n`;
            }
          }
        }

        result += `\n💡 Book your vaccination appointment at Meadow Vet Care: call 083 087 3030 or ask about online booking.`;
        return result;
      },
    },
    {
      name: 'get_driving_route',
      description: 'Get driving or walking distance and estimated travel time from the user\'s location to Meadow Vet Care. Uses OSRM (OpenStreetMap) routing — free, no key required. Use when the user asks how to get to the clinic, how long it takes, or for directions.',
      input_schema: {
        type: 'object',
        properties: {
          from_lat: { type: 'number', description: 'Starting latitude' },
          from_lon: { type: 'number', description: 'Starting longitude' },
          mode: { type: 'string', description: 'Transport mode: driving, walking, cycling (default: driving)' },
        },
        required: [],
      },
      handler: async (input) => {
        const fromLat = input.from_lat as number;
        const fromLon = input.from_lon as number;

        // Meadow Vet Care coordinates (Tonafortes, Carraroe, Co. Sligo)
        const toLat = 54.2787;
        const toLon = -8.4818;
        const mode = (input.mode as string) || 'driving';

        if (!fromLat || !fromLon) {
          return `**Meadow Vet Care — Directions**\n\nAddress: Tonafortes, Carraroe, Co. Sligo, F91 F895\n\nShare your location to get personalised driving/walking directions, or search for "Tonafortes, Carraroe, Sligo" in your maps app.`;
        }

        try {
          // OSRM expects coordinates as lon,lat (NOT lat,lon)
          const url = `https://router.project-osrm.org/route/v1/${mode}/${fromLon},${fromLat};${toLon},${toLat}?overview=false&steps=false`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`OSRM API error: ${res.status}`);
          const data = await res.json();

          if (!data.routes || data.routes.length === 0) {
            return 'Unable to calculate route. Please try again or search for "Tonafortes, Carraroe, Sligo" in your maps app.';
          }

          const route = data.routes[0];
          const distanceKm = (route.distance / 1000).toFixed(1);
          const durationMin = Math.round(route.duration / 60);

          let result = `**Directions to Meadow Vet Care**\n\n`;
          result += `- Distance: ${distanceKm} km\n`;
          result += `- Estimated ${mode} time: ${durationMin} minutes\n`;
          result += `- Address: Tonafortes, Carraroe, Co. Sligo, F91 F895\n\n`;

          if (durationMin <= 5) {
            result += `You're very close! The clinic is just a short ${mode} away.`;
          } else if (durationMin <= 15) {
            result += `Easy commute — about ${durationMin} minutes by ${mode}.`;
          } else if (durationMin <= 30) {
            result += `Around ${durationMin} minutes by ${mode}. Leave a bit of extra time for parking.`;
          } else {
            result += `About ${durationMin} minutes by ${mode}. Consider calling ahead to confirm availability: 083 087 3030.`;
          }

          result += `\n\n🕐 Work Hours: 9am-5pm, Mon-Fri | Emergency (after hours): 083 087 3131`;
          return result;
        } catch (err) {
          return `**Meadow Vet Care — Directions**\n\nAddress: Tonafortes, Carraroe, Co. Sligo, F91 F895\n\nUnable to calculate route right now. Search for "Tonafortes, Carraroe, Sligo" in Google Maps or Apple Maps.`;
        }
      },
    },
  ];
}

export async function callMCPTool(toolName: string, input: Record<string, unknown>): Promise<string> {
  const tools = getMCPTools();
  const tool = tools.find(t => t.name === toolName);
  if (!tool) return `Unknown tool: ${toolName}`;
  return tool.handler(input);
}
