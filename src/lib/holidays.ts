// Irish public holidays fetcher using Tallyfy API (free, no key required)
// Source: https://tallyfy.com/national-holidays/

export interface Holiday {
  date: string;         // YYYY-MM-DD
  name: string;
  local_name: string;
  type: string;         // 'national' | 'bank'
  observed_date: string;
  is_observed_shifted: boolean;
  description: string;
}

interface HolidayCache {
  year: number;
  holidays: Holiday[];
  fetchedAt: number;
}

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
let cache: HolidayCache | null = null;

export async function fetchIrishHolidays(year?: number): Promise<Holiday[]> {
  const targetYear = year || new Date().getFullYear();

  if (cache && cache.year === targetYear && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return cache.holidays;
  }

  try {
    const res = await fetch(`https://tallyfy.com/national-holidays/api/IE/${targetYear}.json`);
    if (!res.ok) throw new Error(`Holiday API error: ${res.status}`);
    const data = await res.json();
    const holidays: Holiday[] = data.holidays || [];

    cache = { year: targetYear, holidays, fetchedAt: Date.now() };
    return holidays;
  } catch (err) {
    console.error('Failed to fetch holidays:', err);
    if (cache && cache.year === targetYear) return cache.holidays;
    return [];
  }
}

export async function isPublicHoliday(dateStr: string): Promise<{ isHoliday: boolean; holiday?: Holiday }> {
  const date = new Date(dateStr);
  const holidays = await fetchIrishHolidays(date.getFullYear());

  // Check exact date match
  const exact = holidays.find(h => h.observed_date === dateStr);
  if (exact) return { isHoliday: true, holiday: exact };

  // Also check the original date (in case observed date is shifted)
  const original = holidays.find(h => h.date === dateStr);
  if (original) return { isHoliday: true, holiday: original };

  return { isHoliday: false };
}

export async function isClosed(dateStr: string): Promise<{ closed: boolean; reason: string }> {
  const date = new Date(dateStr);
  const day = date.getDay();

  // Check weekend (Sunday=0, Saturday=6)
  if (day === 0) return { closed: true, reason: 'Sundays — the clinic is closed.' };
  if (day === 6) return { closed: true, reason: 'Saturdays — the clinic is closed.' };

  // Check public holiday
  const { isHoliday, holiday } = await isPublicHoliday(dateStr);
  if (isHoliday) {
    return { closed: true, reason: `${holiday!.name} — the clinic is closed on public holidays.` };
  }

  return { closed: false, reason: '' };
}

export async function getNextHoliday(): Promise<Holiday | null> {
  const now = new Date();
  const holidays = await fetchIrishHolidays(now.getFullYear());

  const today = now.toISOString().split('T')[0];
  const upcoming = holidays
    .filter(h => h.observed_date >= today)
    .sort((a, b) => a.observed_date.localeCompare(b.observed_date));

  return upcoming[0] || null;
}

export async function getHolidaySummary(): Promise<string> {
  const holidays = await fetchIrishHolidays();
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const past = holidays.filter(h => h.observed_date < today);
  const upcoming = holidays.filter(h => h.observed_date >= today);

  let summary = `Irish Public Holidays (${now.getFullYear()}):\n\n`;

  if (upcoming.length > 0) {
    summary += `Upcoming:\n`;
    for (const h of upcoming) {
      summary += `  - ${h.observed_date}: ${h.name} (${h.local_name})\n`;
    }
  }

  if (past.length > 0) {
    summary += `\nAlready passed:\n`;
    for (const h of past) {
      summary += `  - ${h.observed_date}: ${h.name}\n`;
    }
  }

  summary += `\nNote: The clinic is closed on all public holidays and weekends.`;
  return summary;
}
