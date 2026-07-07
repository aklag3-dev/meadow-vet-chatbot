// Google Sheets live data fetcher
// Fetches CSV from the public Google Sheet and parses it into typed objects

import { parse } from 'csv-parse/sync';

export interface VetService {
  service_id: string;
  category: string;
  species: string;
  price_eur: number;
  duration_min: number;
  requires_appointment: string;
  availability: string;
  slots_this_week: number;
  special_offer: string;
  service_name: string;
  description: string;
}

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1JhSODtviGHzXru6Eb5MhfXfVIF5vtJk3pclzzv7j2l4/export?format=csv&gid=1277715587';

let cache: VetService[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchServices(): Promise<VetService[]> {
  const now = Date.now();
  if (cache && now - cacheTime < CACHE_TTL) {
    return cache;
  }

  try {
    const res = await fetch(SHEET_URL, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
    const csv = await res.text();

    const records = parse(csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    cache = records.map((r: Record<string, string>) => ({
      service_id: r.service_id || '',
      category: r.category || '',
      species: r.species || '',
      price_eur: parseFloat(r.price_eur) || 0,
      duration_min: parseInt(r.duration_min) || 0,
      requires_appointment: r.requires_appointment || '',
      availability: r.availability || '',
      slots_this_week: parseInt(r.slots_this_week) || 0,
      special_offer: r.special_offer || '',
      service_name: r.service_name || '',
      description: r.description || '',
    }));

    cacheTime = now;
    return cache!;
  } catch (err) {
    console.error('Failed to fetch sheet:', err);
    if (cache) return cache;
    throw err;
  }
}

export function formatPrice(cents: number): string {
  // Sheet prices are in cents (e.g., 550 = €5.50, 2300 = €23.00)
  return `€${(cents / 100).toFixed(2)}`;
}

export function getSpeciesList(): string[] {
  return ['Dog', 'Cat', 'Rabbit', 'Small mammal', 'Bird'];
}

export function getCategoryList(): string[] {
  return [
    'Consultation', 'Preventive', 'Nutrition', 'Vaccination',
    'Microchip & ID', 'Dental', 'Surgery', 'Diagnostics',
    'Grooming', 'Behaviour', 'Emergency', 'End-of-life',
  ];
}
