// Diagnostic endpoint — checks if LLM_API_KEY is configured
// DELETE this before going to production

import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.LLM_API_KEY || '';
  const baseUrl = process.env.LLM_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/';
  const model = process.env.LLM_MODEL || 'gemini-2.5-flash';

  if (!key) {
    return NextResponse.json({
      status: 'MISSING',
      error: 'LLM_API_KEY is not set in environment variables',
      help: 'Go to Vercel → Project → Settings → Environment Variables and add LLM_API_KEY',
    });
  }

  // Quick test call to Gemini
  let apiTest = 'not attempted';
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Say "hello" in one word.' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      },
    );
    const data = await res.json();
    if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
      apiTest = 'SUCCESS — ' + data.candidates[0].content.parts[0].text.trim();
    } else {
      apiTest = `FAILED (${res.status}) — ${JSON.stringify(data).substring(0, 200)}`;
    }
  } catch (err: any) {
    apiTest = `ERROR — ${err.message}`;
  }

  return NextResponse.json({
    status: 'KEY_PRESENT',
    keyPrefix: key.substring(0, 6) + '...',
    keyLength: key.length,
    baseUrl,
    model,
    apiTest,
  });
}
