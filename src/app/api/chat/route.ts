// API route for chat — connects the frontend to the LLM + MCP tools

import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/llm';

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const apiKey = process.env.LLM_API_KEY || '';
    console.log(`Chat request - API key ${apiKey ? 'present (' + apiKey.substring(0, 6) + '...)' : 'MISSING'}`);

    const reply = await chat(message);
    return NextResponse.json({ reply });
  } catch (err) {
    console.error('Chat error:', err);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
