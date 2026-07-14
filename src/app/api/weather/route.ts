// API route for weather data (enhanced with wind, UV, air quality, and EU/ROI disclaimer)

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWeather, formatWeatherReport, isGoodForWalkingPet, getWeatherDisclaimer } from '@/lib/weather';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = parseFloat(searchParams.get('lat') || '54.2766');
    const lon = parseFloat(searchParams.get('lon') || '-8.5783');
    const location = searchParams.get('location') || 'Sligo, Ireland';

    const weather = await getCurrentWeather(lat, lon, location);
    const report = formatWeatherReport(weather);
    const walkingAdvice = isGoodForWalkingPet(weather);
    const disclaimer = getWeatherDisclaimer();

    return NextResponse.json({
      weather,
      report,
      walking_advice: walkingAdvice,
      disclaimer,
      location_note: `Weather data is for ${location} and surrounding areas only. For a more accurate assessment, please provide your specific location. Always verify with official Met Éireann forecasts (www.met.ie).`,
    });
  } catch (err) {
    console.error('Weather API error:', err);
    return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 500 });
  }
}
