// Weather fetcher using Open-Meteo API (free, no key required)
// Default location: Sligo, Ireland (54.2766, -8.5783)

export interface WeatherData {
  temperature_c: number;
  weather_code: number;
  weather_description: string;
  is_day: boolean;
  location: string;
  timestamp: string;
}

interface WeatherCache {
  data: WeatherData;
  fetchedAt: number;
}

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
let cache: WeatherCache | null = null;

// Default: Sligo, Ireland
const DEFAULT_LAT = 54.2766;
const DEFAULT_LON = -8.5783;
const DEFAULT_LOCATION = 'Sligo, Ireland';

// WMO Weather interpretation codes
const WMO_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

function getWeatherDescription(code: number): string {
  return WMO_CODES[code] || `Weather code ${code}`;
}

export async function getCurrentWeather(
  lat: number = DEFAULT_LAT,
  lon: number = DEFAULT_LON,
  locationName: string = DEFAULT_LOCATION,
): Promise<WeatherData> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return cache.data;
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&timezone=Europe/Dublin`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather API error: ${res.status}`);
    const data = await res.json();

    const current = data.current;
    const weatherData: WeatherData = {
      temperature_c: current.temperature_2m,
      weather_code: current.weather_code,
      weather_description: getWeatherDescription(current.weather_code),
      is_day: current.is_day === 1,
      location: locationName,
      timestamp: current.time,
    };

    cache = { data: weatherData, fetchedAt: Date.now() };
    return weatherData;
  } catch (err) {
    console.error('Failed to fetch weather:', err);
    // Return cached data if available
    if (cache) return cache.data;
    throw err;
  }
}

export function isGoodForWalkingPet(tempC: number, weatherCode: number): { suitable: boolean; advice: string } {
  // Temperature checks
  if (tempC > 30) {
    return {
      suitable: false,
      advice: `It's ${tempC}°C — too hot to walk your pet. Risk of heatstroke. Walk early morning or after sunset, and bring water.`,
    };
  }
  if (tempC > 25) {
    return {
      suitable: true,
      advice: `It's ${tempC}°C — warm but manageable. Walk in shade, bring water, and avoid midday heat.`,
    };
  }
  if (tempC < 0) {
    return {
      suitable: false,
      advice: `It's ${tempC}°C — freezing conditions. Limit outdoor time, check paw pads for ice/salt, and consider a coat for short-haired pets.`,
    };
  }
  if (tempC < 5) {
    return {
      suitable: true,
      advice: `It's ${tempC}°C — cold. Consider a coat for small or short-haired pets. Keep walks shorter.`,
    };
  }

  // Weather code checks
  if ([95, 96, 99].includes(weatherCode)) {
    return {
      suitable: false,
      advice: `Thunderstorms forecast — best to keep pets indoors. Lightning and loud thunder can cause anxiety.`,
    };
  }
  if ([65, 67, 75, 82].includes(weatherCode)) {
    return {
      suitable: true,
      advice: `Heavy rain/snow — use a coat or umbrella, dry off thoroughly after, and check paws for ice.`,
    };
  }

  return {
    suitable: true,
    advice: `Conditions look good for a walk! Current temperature is ${tempC}°C with ${getWeatherDescription(weatherCode).toLowerCase()} conditions.`,
  };
}

export function formatWeatherReport(weather: WeatherData): string {
  const timeOfDay = weather.is_day ? 'daytime' : 'night-time';
  return `Current weather in ${weather.location} (${timeOfDay}):
- Temperature: ${weather.temperature_c}°C
- Conditions: ${weather.weather_description}
- As of: ${weather.timestamp}`;
}
