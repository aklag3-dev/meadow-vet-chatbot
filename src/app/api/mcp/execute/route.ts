// POST /api/mcp/execute — execute an MCP tool directly

import { NextRequest, NextResponse } from 'next/server';
import { callMCPTool } from '@/lib/mcp-tools';

export async function POST(req: NextRequest) {
  try {
    const { tool, input } = await req.json();
    if (!tool || typeof tool !== 'string') {
      return NextResponse.json({ error: 'tool name is required' }, { status: 400 });
    }
    const result = await callMCPTool(tool, input || {});
    return NextResponse.json({ result });
  } catch (err) {
    console.error('MCP execute error:', err);
    return NextResponse.json({ error: 'Tool execution failed' }, { status: 500 });
  }
}
