// LLM integration with function calling (MCP tool use)
// Supports OpenAI-compatible APIs (OpenAI, OpenRouter, etc.)

import { getMCPTools, callMCPTool } from './mcp-tools';

export interface UserLocation {
  lat: number;
  lon: number;
  label?: string;
}

function getSystemPrompt(location?: UserLocation): string {
  const now = new Date();
  const today = now.toLocaleDateString('en-IE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const isoDate = now.toISOString().split('T')[0];

  const locationSection = location
    ? `The user has shared their location: ${location.lat.toFixed(4)}°N, ${location.lon.toFixed(4)}°W${location.label ? ` (${location.label})` : ''}.
Use these coordinates when calling weather tools — do NOT default to Sligo.`
    : `The user has NOT shared their location. Weather data defaults to Sligo, Ireland (54.2766, -8.5783). If the user asks about weather, clarify that the data is for Sligo only and encourage them to enable location sharing for more accurate results.`;

  const nowHour = now.getHours();
  const nowMinutes = now.getMinutes();
  const isBusinessHours = (nowHour >= 9 && nowHour < 17) || (nowHour === 17 && nowMinutes === 0);
  const dayOfWeek = now.getDay();
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const isOpenNow = isBusinessHours && isWeekday;

  return `You are a friendly, knowledgeable assistant for Meadow Vet Care, a modern veterinary clinic in Carraroe, Co. Sligo, Ireland.

Today's date is ${today} (${isoDate}).

MEADOW VET CARE — BUSINESS DETAILS:
- Address: Tonafortes, Carraroe, Co. Sligo, F91 F895
- Work Hours: 9:00am to 5:00pm, Monday to Friday (Closed on Public Holidays and Weekends)
- Reception Phone (Work Hours): 083 087 3030
- Emergency Phone (Out of Hours): 083 087 3131
- Emergency Fees: €100 Emergency consultation fee, €200 Emergency call out fee
- The clinic is currently: ${isOpenNow ? 'OPEN (call 083 087 3030)' : 'CLOSED (emergency: 083 087 3131)'}

You help pet owners find the right services for their pets. You have LIVE access to the clinic's service data through MCP tools.

You also have access to:
- Irish public holidays data (so you can tell users if the clinic is open/closed on specific dates)
- Current weather data (so you can advise on pet walking conditions)
- Pet breed information (so you can provide breed-specific health and care advice)
- Pollen and air quality forecasts (for pets with seasonal allergies)
- Driving directions from the user's location to the clinic
- Emergency veterinary guidance (time-aware — different advice during vs. after business hours)

${locationSection}

Guidelines:
- Always use the MCP tools to get current, accurate data. Never guess prices or availability.
- Be warm and helpful — you're talking to pet owners who love their animals.
- Mention special offers when relevant.
- If asked about something not in the data, say so honestly and suggest they call the clinic.
- Keep responses concise but complete. Use bullet points for lists of services.
- Format prices clearly (e.g., €5.50).
- When listing services, group them logically and include price, duration, and availability.
- If a service has no slots this week, mention that but still include it.

EMERGENCY GUIDELINES:
- For ANY emergency question (symptoms, accidents, toxin ingestion), ALWAYS call the get_local_pet_emergency_info tool FIRST.
- During business hours (Mon-Fri 9am-5pm): direct users to call reception on 083 087 3030.
- After hours, weekends, and public holidays: direct users to the emergency line on 083 087 3131.
- Always include the emergency fees: €100 consultation + €200 call out (after hours).
- For toxin ingestion, describe what was eaten. Use get_pet_breed_info for breed-specific toxin sensitivities, then call the emergency tool.
- Be direct and urgent when needed — don't soften emergency guidance. Time matters.
- You are NOT a vet. You cannot give medical advice. Always direct medical concerns to the clinic team.

WEATHER GUIDELINES:
- When providing weather information, include all available data: temperature (actual and feels-like), wind speed/gusts, UV index, and air quality (European AQI).
- Always advise the user on whether conditions are suitable for walking their pet.
- When the user has shared their location, weather data will be fetched for their coordinates. When they have NOT shared their location, clarify that weather is for Sligo only.
- For UV advice: warn about sunburn risk when UV is 6+.
- For air quality: advise shorter walks for brachycephalic breeds when AQI is above 60.
- For wind: advise secure leads when gusts exceed 40 km/h.

BREED HEALTH GUIDELINES:
- Use get_pet_breed_info to provide breed-specific health advice.
- When a user mentions their pet's breed, proactively suggest relevant health checks.
- Link breed health issues to Meadow Vet services (e.g., "Hip screening available — book a consultation").

POLLEN/ALLERGY GUIDELINES:
- Use get_pollen_forecast to check pollen levels for allergy-prone pets.
- Dogs with allergies: advise wiping paws after walks when grass pollen is high.
- Cats with allergies: keep indoors when pollen counts are elevated.
- Breeds prone to respiratory issues (pugs, bulldogs, Persians) should limit outdoor time when pollen + AQI are both high.

DIRECTIONS GUIDELINES:
- Use get_driving_route to provide distance and ETA to the clinic.
- When the user shares their location, you can provide driving/walking directions.
- Always include the clinic address with Eircode: Tonafortes, Carraroe, Co. Sligo, F91 F895.

LOCATION-BASED SERVICES:
- When the user shares their location, you can provide location-relevant weather, directions, and nearby services.
- Always respect user privacy — do not store, log, or share their location data. It is only used for the current request.

HOLIDAY/DATE GUIDELINES:
- Use check_date to confirm whether the clinic is open on a specific date.
- When users ask relative dates like "Monday" or "next week", calculate the actual date using today's date and use the check_date tool.
- When users ask relative date questions (e.g., "Are you open Monday?"), you MUST calculate the actual date and use the check_date tool. Do NOT ask them to specify the date — infer it from the current day.`;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  name?: string;
}

async function callOpenAICompatible(
  messages: ChatMessage[],
  apiKey: string,
  baseUrl: string,
  model: string,
): Promise<string> {
  const tools = getMCPTools().map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));

  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`LLM API ${res.status}:`, err);
    throw new Error(`LLM API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return JSON.stringify(data.choices[0].message);
}

async function agentLoop(
  userMessage: string,
  apiKey: string,
  baseUrl: string,
  model: string,
  location?: UserLocation,
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: getSystemPrompt(location) },
    { role: 'user', content: userMessage },
  ];

  // Agentic loop: keep calling tools until the LLM gives a final text response
  for (let i = 0; i < 10; i++) {
    const responseStr = await callOpenAICompatible(messages, apiKey, baseUrl, model);
    const response = JSON.parse(responseStr);

    // If the LLM wants to call tools
    if (response.tool_calls && response.tool_calls.length > 0) {
      // Add the assistant's tool_call message
      messages.push({
        role: 'assistant',
        content: response.content || '',
        tool_calls: response.tool_calls,
      });

      // Execute each tool call
      for (const tc of response.tool_calls) {
        const args = JSON.parse(tc.function.arguments);
        // Inject user location into location-aware tools if available and not already set
        if (location) {
          if (tc.function.name === 'get_driving_route') {
            if (!args.from_lat) { args.from_lat = location.lat; args.from_lon = location.lon; }
          } else if (['get_weather', 'get_nearby_emergency_vet', 'get_pollen_forecast'].includes(tc.function.name)) {
            if (!args.latitude) {
              args.latitude = location.lat;
              args.longitude = location.lon;
              if (!args.location_name) {
                args.location_name = location.label || `Your location (${location.lat.toFixed(2)}, ${location.lon.toFixed(2)})`;
              }
            }
          }
        }
        const result = await callMCPTool(tc.function.name, args);
        messages.push({
          role: 'tool',
          content: result,
          tool_call_id: tc.id,
        });
      }
      // Continue the loop for the LLM to process tool results
    } else {
      // Final text response
      return response.content || 'I couldn\'t find an answer. Please try rephrasing your question.';
    }
  }

  return 'I looked up several things but got stuck. Could you ask a simpler question?';
}

export async function chat(userMessage: string, location?: UserLocation): Promise<string> {
  const apiKey = process.env.LLM_API_KEY || '';
  const baseUrl = process.env.LLM_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/';
  const model = process.env.LLM_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    return demoMode(userMessage);
  }

  // Try OpenAI-compatible endpoint first
  try {
    return await agentLoop(userMessage, apiKey, baseUrl, model, location);
  } catch (openaiErr) {
    console.warn('OpenAI-compatible endpoint failed, trying native Gemini API:', openaiErr);
  }

  // Fallback: native Gemini generateContent API
  try {
    return await nativeGeminiCall(userMessage, apiKey, model, location);
  } catch (nativeErr) {
    console.error('Native Gemini API also failed:', nativeErr);
    return demoMode(userMessage);
  }
}

async function nativeGeminiCall(
  userMessage: string,
  apiKey: string,
  model: string,
  location?: UserLocation,
): Promise<string> {
  const { fetchServices, formatPrice } = await import('./sheets');
  const services = await fetchServices();
  const servicesJson = JSON.stringify(services);

  const systemInstruction = getSystemPrompt(location) + `\n\nHere is the current service data as JSON:\n${servicesJson}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini native API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return text || 'I couldn\'t generate a response. Please try again.';
}

// Fallback demo mode when no LLM API key is configured
async function demoMode(userMessage: string): Promise<string> {
  const lower = userMessage.toLowerCase();
  const { fetchServices, formatPrice } = await import('./sheets');
  const services = await fetchServices();

  // Simple keyword matching for demo
  if (lower.includes('dog') && (lower.includes('service') || lower.includes('offer'))) {
    const dogServices = services.filter(s => s.species === 'Dog');
    let msg = `Meadow Vet Care offers ${dogServices.length} services for dogs:\n\n`;
    const grouped: Record<string, typeof dogServices> = {};
    for (const s of dogServices) {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s);
    }
    for (const [cat, group] of Object.entries(grouped)) {
      msg += `**${cat}:**\n`;
      for (const s of group) {
        const offer = s.special_offer ? ` ★ ${s.special_offer}` : '';
        msg += `  - ${s.service_name}: ${formatPrice(s.price_eur)} (${s.duration_min}min)${offer}\n`;
      }
      msg += '\n';
    }
    return msg;
  }

  if (lower.includes('microchip')) {
    const chipServices = services.filter(s => s.service_name.toLowerCase().includes('microchip'));
    if (chipServices.length === 0) return 'No microchipping services found.';
    let msg = 'Here are our microchipping services:\n\n';
    for (const s of chipServices) {
      const offer = s.special_offer ? ` ★ ${s.special_offer}` : '';
      msg += `- **${s.species}** Microchipping: ${formatPrice(s.price_eur)} (${s.duration_min}min) | ${s.availability}${offer}\n`;
    }
    return msg;
  }

  if (lower.includes('telehealth') || lower.includes('video')) {
    const teleServices = services.filter(s => s.service_name.toLowerCase().includes('telehealth'));
    if (teleServices.length === 0) return 'No telehealth services found.';
    let msg = 'Yes! We offer telehealth video consultations:\n\n';
    for (const s of teleServices) {
      msg += `- **${s.species}**: ${formatPrice(s.price_eur)} (${s.duration_min}min) | ${s.availability}\n`;
    }
    return msg;
  }

  if (lower.includes('offer') || lower.includes('deal') || lower.includes('discount')) {
    const offers = services.filter(s => s.special_offer);
    if (offers.length === 0) return 'No current offers available.';
    let msg = `We have ${offers.length} services with special offers right now:\n\n`;
    for (const s of offers) {
      msg += `- **${s.species}** ${s.service_name}: ${formatPrice(s.price_eur)} — ${s.special_offer}\n`;
    }
    return msg;
  }

  if (lower.includes('emergency')) {
    const emergencies = services.filter(s => s.category === 'Emergency');
    let msg = 'Our emergency services (available 24/7):\n\n';
    for (const s of emergencies) {
      const offer = s.special_offer ? ` ★ ${s.special_offer}` : '';
      msg += `- **${s.species}**: ${s.service_name} — ${formatPrice(s.price_eur)} (${s.duration_min}min)${offer}\n`;
    }
    return msg;
  }

  // Default: show clinic summary
  const species = [...new Set(services.map(s => s.species))];
  const categories = [...new Set(services.map(s => s.category))];
  return `Welcome to Meadow Vet Care! 🐾

We offer ${services.length} services across ${species.length} species: ${species.join(', ')}.

Our categories include: ${categories.join(', ')}.

Ask me about:
- Services for a specific pet (e.g., "What dog services do you offer?")
- Current offers and deals
- Telehealth / video consultations
- Emergency services
- Pricing and availability

How can I help you today?`;
}
