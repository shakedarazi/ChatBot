// packages/server/services/weather.service.ts
type GeoResult = {
   name: string;
   latitude: number;
   longitude: number;
   country?: string;
   admin1?: string;
};

async function geocodeCity(city: string): Promise<GeoResult | null> {
   const url =
      'https://geocoding-api.open-meteo.com/v1/search?' +
      new URLSearchParams({
         name: city,
         count: '1',
         language: 'en',
         format: 'json',
      });

   const res = await fetch(url);
   if (!res.ok) return null;

   const data = (await res.json()) as any;
   const first = data?.results?.[0];
   if (!first) return null;

   return {
      name: first.name,
      latitude: first.latitude,
      longitude: first.longitude,
      country: first.country,
      admin1: first.admin1,
   };
}

function weatherCodeToText(code: number): string {
   const map: Record<number, string> = {
      0: 'Sunny',
      1: 'Mostly clear',
      2: 'Partly cloudy',
      3: 'Cloudy',
      45: 'Fog',
      48: 'Freezing fog',
      51: 'Light drizzle',
      53: 'Drizzle',
      55: 'Heavy drizzle',
      61: 'Light rain',
      63: 'Rain',
      65: 'Heavy rain',
      71: 'Light snow',
      73: 'Snow',
      75: 'Heavy snow',
      80: 'Light showers',
      81: 'Showers',
      82: 'Heavy showers',
      95: 'Thunderstorm',
   };
   return map[code] ?? 'Unknown';
}

export async function getWeather(city: string): Promise<string> {
   const cleanCity = city.replace(/[!?.,]/g, '').trim();

   const geo = await geocodeCity(cleanCity);
   if (!geo) return `Could not find city "${cleanCity}". Try another name.`;

   const url =
      'https://api.open-meteo.com/v1/forecast?' +
      new URLSearchParams({
         latitude: String(geo.latitude),
         longitude: String(geo.longitude),
         current: 'temperature_2m,weather_code,wind_speed_10m',
         timezone: 'Asia/Jerusalem',
      });

   const res = await fetch(url);
   if (!res.ok) return 'Failed to fetch weather data.';

   const data = (await res.json()) as any;
   const temp = data?.current?.temperature_2m;
   const code = data?.current?.weather_code;
   const wind = data?.current?.wind_speed_10m;

   if (typeof temp !== 'number' || typeof code !== 'number') {
      return 'Could not parse weather response.';
   }

   const desc = weatherCodeToText(code);
   const place = geo.admin1 ? `${geo.name}, ${geo.admin1}` : `${geo.name}`;

   return `${place}: ${temp}°C, ${desc}${typeof wind === 'number' ? `, wind ${wind} km/h` : ''}`;
}
