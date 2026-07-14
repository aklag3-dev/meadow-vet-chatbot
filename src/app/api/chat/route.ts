// API route for chat — connects the frontend to the LLM + MCP tools

import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/llm';

interface ChatRequest {
  message: string;
  location?: {
    lat: number;
    lon: number;
    label?: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();
    const { message, location } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const apiKey = process.env.LLM_API_KEY || '';
    console.log(`Chat request - API key ${apiKey ? 'present (' + apiKey.substring(0, 6) + '...)' : 'MISSING'}${location ? ` | Location: ${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}` : ''}`);

    const reply = await chat(message, location);
    return NextResponse.json({ reply });
  } catch (err) {
    console.error('Chat error:', err);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
