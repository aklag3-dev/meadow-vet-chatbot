// MCP Tool definitions for Meadow Vet Care
// These tools are exposed to the LLM for live data access

import { fetchServices, formatPrice, VetService } from './sheets';

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
  ];
}

export async function callMCPTool(toolName: string, input: Record<string, unknown>): Promise<string> {
  const tools = getMCPTools();
  const tool = tools.find(t => t.name === toolName);
  if (!tool) return `Unknown tool: ${toolName}`;
  return tool.handler(input);
}
