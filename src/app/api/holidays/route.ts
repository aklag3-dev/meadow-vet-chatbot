// API route for Irish public holidays

import { NextResponse } from 'next/server';
import { fetchIrishHolidays, getHolidaySummary } from '@/lib/holidays';

export async function GET() {
  try {
    const summary = await getHolidaySummary();
    const holidays = await fetchIrishHolidays();
    return NextResponse.json({ holidays, summary });
  } catch (err) {
    console.error('Holidays API error:', err);
    return NextResponse.json({ error: 'Failed to fetch holidays' }, { status: 500 });
  }
}
