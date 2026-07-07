// GET /api/mcp — discover available MCP tools

import { NextResponse } from 'next/server';
import { getMCPTools } from '@/lib/mcp-tools';

export async function GET() {
  const tools = getMCPTools().map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
  return NextResponse.json({ tools });
}
