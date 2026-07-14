// MCP Tool definitions for Meadow Vet Care
// These tools are exposed to the LLM for live data access

import { fetchServices, formatPrice, VetService } from './sheets';
import { fetchIrishHolidays, isPublicHoliday, isClosed, getNextHoliday, getHolidaySummary } from './holidays';
import { getCurrentWeather, isGoodForWalkingPet, formatWeatherReport } from './weather';

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
      description: 'Get current weather conditions in Sligo, Ireland. IMPORTANT: Always clarify that this weather data is for Sligo and surrounding areas only. If the user is not nearby, ask them to provide their location for more accurate information. Use this when asked about weather conditions, whether it is suitable to walk a pet, or temperature-related questions.',
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
        const walking = isGoodForWalkingPet(weather.temperature_c, weather.weather_code);

        let result = report;
        result += `\n\nWalking advice: ${walking.advice}`;
        result += `\n\n⚠️ Weather data is for ${locationName} and surrounding areas only. If you are not nearby, please share your location for a more accurate assessment.`;

        return result;
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
