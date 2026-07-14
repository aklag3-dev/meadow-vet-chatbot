// Weather fetcher using Open-Meteo API (free, no key required)
// Default location: Sligo, Ireland (54.2766, -8.5783)
// Includes air quality data from Open-Meteo Air Quality API

export interface AirQualityData {
  european_aqi: number;
  european_aqi_category: string;
  us_aqi: number;
  us_aqi_category: string;
  pm2_5: number;
  pm10: number;
  nitrogen_dioxide: number;
  ozone: number;
}

export interface WeatherData {
  temperature_c: number;
  feels_like_c: number;
  wind_speed_kmh: number;
  wind_gusts_kmh: number;
  weather_code: number;
  weather_description: string;
  uv_index: number;
  uv_category: string;
  is_day: boolean;
  air_quality: AirQualityData;
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

function getUVCategory(uv: number): string {
  if (uv <= 2) return 'Low';
  if (uv <= 5) return 'Moderate';
  if (uv <= 7) return 'High';
  if (uv <= 10) return 'Very High';
  return 'Extreme';
}

function getAQICategory(aqi: number): string {
  if (aqi <= 20) return 'Good';
  if (aqi <= 40) return 'Fair';
  if (aqi <= 60) return 'Moderate';
  if (aqi <= 80) return 'Poor';
  if (aqi <= 100) return 'Very Poor';
  return 'Extremely Poor';
}

function getUSAQICategory(aqi: number): string {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
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
    // Fetch weather data
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,is_day,uv_index&timezone=Europe/Dublin`;
    const weatherRes = await fetch(weatherUrl);
    if (!weatherRes.ok) throw new Error(`Weather API error: ${weatherRes.status}`);
    const weatherJson = await weatherRes.json();

    // Fetch air quality data
    const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone&timezone=Europe/Dublin`;
    const aqRes = await fetch(aqUrl);
    let airQuality: AirQualityData = {
      european_aqi: 0,
      european_aqi_category: 'Unknown',
      us_aqi: 0,
      us_aqi_category: 'Unknown',
      pm2_5: 0,
      pm10: 0,
      nitrogen_dioxide: 0,
      ozone: 0,
    };

    if (aqRes.ok) {
      const aqJson = await aqRes.json();
      const aqCurrent = aqJson.current;
      if (aqCurrent) {
        airQuality = {
          european_aqi: aqCurrent.european_aqi ?? 0,
          european_aqi_category: getAQICategory(aqCurrent.european_aqi ?? 0),
          us_aqi: aqCurrent.us_aqi ?? 0,
          us_aqi_category: getUSAQICategory(aqCurrent.us_aqi ?? 0),
          pm2_5: aqCurrent.pm2_5 ?? 0,
          pm10: aqCurrent.pm10 ?? 0,
          nitrogen_dioxide: aqCurrent.nitrogen_dioxide ?? 0,
          ozone: aqCurrent.ozone ?? 0,
        };
      }
    }

    const current = weatherJson.current;
    const uvVal = current.uv_index ?? 0;
    const weatherData: WeatherData = {
      temperature_c: current.temperature_2m,
      feels_like_c: current.apparent_temperature,
      wind_speed_kmh: current.wind_speed_10m,
      wind_gusts_kmh: current.wind_gusts_10m,
      weather_code: current.weather_code,
      weather_description: getWeatherDescription(current.weather_code),
      uv_index: uvVal,
      uv_category: getUVCategory(uvVal),
      is_day: current.is_day === 1,
      air_quality: airQuality,
      location: locationName,
      timestamp: current.time,
    };

    cache = { data: weatherData, fetchedAt: Date.now() };
    return weatherData;
  } catch (err) {
    console.error('Failed to fetch weather:', err);
    if (cache) return cache.data;
    throw err;
  }
}

export function isGoodForWalkingPet(weather: WeatherData): { suitable: boolean; advice: string } {
  const { temperature_c: tempC, feels_like_c: feelsLike, wind_speed_kmh: wind, wind_gusts_kmh: gusts, weather_code: code, uv_index: uv, air_quality: aq } = weather;
  const issues: string[] = [];
  const tips: string[] = [];

  // Temperature checks
  if (tempC > 30) {
    issues.push(`Temperature is ${tempC}°C (feels like ${feelsLike}°C) — too hot for pets. Risk of heatstroke.`);
    tips.push('Walk early morning or after sunset, bring water, avoid hot pavement.');
  } else if (tempC > 25) {
    tips.push(`Warm at ${tempC}°C (feels like ${feelsLike}°C). Walk in shade, bring water, avoid midday.`);
  } else if (tempC < 0) {
    issues.push(`Temperature is ${tempC}°C — freezing conditions.`);
    tips.push('Limit outdoor time, check paw pads for ice/salt, consider a coat for short-haired pets.');
  } else if (tempC < 5) {
    tips.push(`Cold at ${tempC}°C. Consider a coat for small/short-haired pets. Keep walks shorter.`);
  }

  // Wind checks
  if (gusts > 60) {
    issues.push(`Dangerous wind gusts of ${gusts} km/h.`);
    tips.push('Keep pets indoors or on a very short lead. Flying debris risk.');
  } else if (gusts > 40) {
    tips.push(`Strong gusts up to ${gusts} km/h. Use a secure lead, especially for small dogs.`);
  } else if (wind > 30) {
    tips.push(`Windy at ${wind} km/h. Secure leads recommended.`);
  }

  // UV checks
  if (uv >= 8) {
    issues.push(`Very high UV index (${uv}).`);
    tips.push('Avoid midday sun. Use pet-safe sunscreen on exposed skin (nose, ears). Limit sunbathing.');
  } else if (uv >= 6) {
    tips.push(`High UV (${uv}). Provide shade and fresh water. Watch for signs of overheating.`);
  } else if (uv >= 3) {
    tips.push(`Moderate UV (${uv}). Normal precautions apply.`);
  }

  // Weather code checks
  if ([95, 96, 99].includes(code)) {
    issues.push('Thunderstorms forecast — keep pets indoors. Lightning and loud thunder can cause anxiety.');
  } else if ([65, 67, 75, 82].includes(code)) {
    tips.push('Heavy rain/snow expected. Use a coat, dry off thoroughly after, check paws for ice.');
  } else if ([61, 63, 80, 81].includes(code)) {
    tips.push('Rain expected. Bring an umbrella or coat for your pet.');
  }

  // Air quality checks
  if (aq.european_aqi > 80) {
    issues.push(`Poor air quality (European AQI: ${aq.european_aqi} — ${aq.european_aqi_category}).`);
    tips.push('Limit outdoor exertion, especially for brachycephalic breeds (pugs, bulldogs) and elderly pets.');
  } else if (aq.european_aqi > 60) {
    tips.push(`Moderate air quality (European AQI: ${aq.european_aqi}). Sensitive pets may need shorter walks.`);
  }

  if (issues.length > 0) {
    return {
      suitable: false,
      advice: issues.join(' ') + (tips.length > 0 ? ' ' + tips.join(' ') : ''),
    };
  }

  if (tips.length > 0) {
    return {
      suitable: true,
      advice: tips.join(' '),
    };
  }

  return {
    suitable: true,
    advice: `Conditions look good for a walk! ${tempC}°C with ${getWeatherDescription(code).toLowerCase()} conditions.`,
  };
}

export function formatWeatherReport(weather: WeatherData): string {
  const timeOfDay = weather.is_day ? 'Daytime' : 'Night-time';
  let report = `${timeOfDay} weather in ${weather.location}:\n`;
  report += `- Temperature: ${weather.temperature_c}°C (feels like ${weather.feels_like_c}°C)\n`;
  report += `- Conditions: ${weather.weather_description}\n`;
  report += `- Wind: ${weather.wind_speed_kmh} km/h (gusts up to ${weather.wind_gusts_kmh} km/h)\n`;
  report += `- UV Index: ${weather.uv_index} (${weather.uv_category})\n`;
  report += `- Air Quality: European AQI ${weather.air_quality.european_aqi} (${weather.air_quality.european_aqi_category})\n`;
  report += `  PM2.5: ${weather.air_quality.pm2_5} µg/m³ | PM10: ${weather.air_quality.pm10} µg/m³\n`;
  report += `  NO₂: ${weather.air_quality.nitrogen_dioxide} µg/m³ | O₃: ${weather.air_quality.ozone} µg/m³\n`;
  report += `- As of: ${weather.timestamp}`;
  return report;
}

// EU/ROI compliant weather disclaimer
export function getWeatherDisclaimer(): string {
  return [
    '--- Weather Data Disclaimer ---',
    'Data source: Open-Meteo (open-meteo.com), which uses ECMWF, GFS, and ICON numerical weather prediction models.',
    'This is NOT official Met Éireann (Irish meteorological service) data and should not be treated as authoritative weather information.',
    'Weather forecasts are inherently uncertain and become less reliable beyond 2–3 days.',
    'This data is provided for general informational purposes only and is supplementary to official forecasts from Met Éireann (www.met.ie).',
    'No warranty: Weather data is provided "as is" without warranty of any kind, express or implied, including but not limited to accuracy, completeness, or fitness for a particular purpose.',
    'Limitation of liability: Meadow Vet Care, its operators, and affiliates shall not be held liable for any direct, indirect, incidental, consequential, or special damages arising from reliance on this weather data, including but not limited to decisions made regarding pet care, outdoor activities, or travel.',
    'User acknowledgement: By using this service, you acknowledge that the weather data is indicative only, that conditions may vary locally, and that you are responsible for checking official forecasts (www.met.ie) before making decisions that depend on weather conditions.',
    'Compliance: This disclaimer is provided in accordance with the EU General Data Protection Regulation (GDPR), the EU Consumer Rights Directive 2011/83/EU, the Irish Consumer Protection Act 2007, and the EU Unfair Commercial Practices Directive 2005/29/EC.',
    '--- End Disclaimer ---',
  ].join('\n');
}
