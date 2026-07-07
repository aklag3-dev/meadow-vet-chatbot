// LLM integration with function calling (MCP tool use)
// Supports OpenAI-compatible APIs (OpenAI, OpenRouter, etc.)

import { getMCPTools, callMCPTool } from './mcp-tools';

const SYSTEM_PROMPT = `You are a friendly, knowledgeable assistant for Meadow Vet Care, a modern veterinary clinic in Ireland.

You help pet owners find the right services for their pets. You have LIVE access to the clinic's service data through MCP tools.

Guidelines:
- Always use the MCP tools to get current, accurate data. Never guess prices or availability.
- Be warm and helpful — you're talking to pet owners who love their animals.
- Mention special offers when relevant.
- If asked about something not in the data, say so honestly and suggest they call the clinic.
- Keep responses concise but complete. Use bullet points for lists of services.
- Format prices clearly (e.g., €5.50).
- When listing services, group them logically and include price, duration, and availability.
- If a service has no slots this week, mention that but still include it.
- For emergency questions, emphasize the 24/7 availability.

You are NOT a vet. You cannot give medical advice. Always direct medical concerns to the clinic team.`;

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
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
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

export async function chat(userMessage: string): Promise<string> {
  const apiKey = process.env.LLM_API_KEY || '';
  const baseUrl = process.env.LLM_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/';
  const model = process.env.LLM_MODEL || 'gemini-2.0-flash';

  if (!apiKey) {
    return demoMode(userMessage);
  }

  // Try OpenAI-compatible endpoint first
  try {
    return await agentLoop(userMessage, apiKey, baseUrl, model);
  } catch (openaiErr) {
    console.warn('OpenAI-compatible endpoint failed, trying native Gemini API:', openaiErr);
  }

  // Fallback: native Gemini generateContent API
  try {
    return await nativeGeminiCall(userMessage, apiKey, model);
  } catch (nativeErr) {
    console.error('Native Gemini API also failed:', nativeErr);
    return demoMode(userMessage);
  }
}

async function nativeGeminiCall(
  userMessage: string,
  apiKey: string,
  model: string,
): Promise<string> {
  const { fetchServices, formatPrice } = await import('./sheets');
  const services = await fetchServices();
  const servicesJson = JSON.stringify(services);

  const systemInstruction = SYSTEM_PROMPT + `\n\nHere is the current service data as JSON:\n${servicesJson}`;

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
