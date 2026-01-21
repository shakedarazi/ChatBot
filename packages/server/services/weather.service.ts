type GeoResult = {
   name: string;
   latitude: number;
   longitude: number;
   country?: string;
   admin1?: string;
};

function hasHebrew(text: string): boolean {
   return /[\u0590-\u05FF]/.test(text);
}

async function geocodeCityOnce(
   city: string,
   language: 'en' | 'he'
): Promise<GeoResult | null> {
   const url =
      'https://geocoding-api.open-meteo.com/v1/search?' +
      new URLSearchParams({
         name: city,
         count: '5',
         language,
         format: 'json',
      });

   const res = await fetch(url);
   if (!res.ok) return null;

   const data = (await res.json()) as any;
   const results = data?.results;
   if (!Array.isArray(results) || results.length === 0) return null;

   const first = results[0];

   return {
      name: first.name,
      latitude: first.latitude,
      longitude: first.longitude,
      country: first.country,
      admin1: first.admin1,
   };
}

async function geocodeCity(city: string): Promise<GeoResult | null> {
   const clean = city.replace(/[!?.,]/g, '').trim();
   const isHeb = hasHebrew(clean);

   const firstLang: 'he' | 'en' = isHeb ? 'he' : 'en';
   const secondLang: 'he' | 'en' = firstLang === 'he' ? 'en' : 'he';

   const direct =
      (await geocodeCityOnce(clean, firstLang)) ??
      (await geocodeCityOnce(clean, secondLang));

   if (direct) return direct;

   const withIL = `${clean}, IL`;

   return (
      (await geocodeCityOnce(withIL, firstLang)) ??
      (await geocodeCityOnce(withIL, secondLang))
   );
}

function weatherCodeToText(code: number, lang: 'he' | 'en'): string {
   const he: Record<number, string> = {
      0: 'שמשי',
      1: 'בהיר ברובו',
      2: 'מעונן חלקית',
      3: 'מעונן',
      45: 'ערפל',
      48: 'ערפל קפוא',
      51: 'טפטוף קל',
      53: 'טפטוף',
      55: 'טפטוף חזק',
      61: 'גשם קל',
      63: 'גשם',
      65: 'גשם חזק',
      71: 'שלג קל',
      73: 'שלג',
      75: 'שלג כבד',
      80: 'ממטרים קלים',
      81: 'ממטרים',
      82: 'ממטרים חזקים',
      95: 'סופת רעמים',
   };

   const en: Record<number, string> = {
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

   return (
      (lang === 'he' ? he : en)[code] ?? (lang === 'he' ? 'לא ידוע' : 'Unknown')
   );
}

export async function getWeather(city: string): Promise<string> {
   const cleanCity = city.replace(/[!?.,]/g, '').trim();
   const lang: 'he' | 'en' = hasHebrew(cleanCity) ? 'he' : 'en';

   const geo = await geocodeCity(cleanCity);

   if (!geo) {
      return lang === 'he'
         ? `לא הצלחתי למצוא את העיר "${cleanCity}". נסי שם אחר או כתיב באנגלית.`
         : `Could not find city "${cleanCity}". Try another name.`;
   }

   const url =
      'https://api.open-meteo.com/v1/forecast?' +
      new URLSearchParams({
         latitude: String(geo.latitude),
         longitude: String(geo.longitude),
         current: 'temperature_2m,weather_code,wind_speed_10m',
         timezone: 'Asia/Jerusalem',
      });

   const res = await fetch(url);
   if (!res.ok) {
      return lang === 'he'
         ? 'שגיאה בשליפת נתוני מזג האוויר.'
         : 'Failed to fetch weather data.';
   }

   const data = (await res.json()) as any;
   const temp = data?.current?.temperature_2m;
   const code = data?.current?.weather_code;
   const wind = data?.current?.wind_speed_10m;

   if (typeof temp !== 'number' || typeof code !== 'number') {
      return lang === 'he'
         ? 'שגיאה בפענוח נתוני מזג האוויר.'
         : 'Could not parse weather response.';
   }

   const desc = weatherCodeToText(code, lang);
   const place = geo.admin1 ? `${geo.name}` : geo.name;

   if (lang === 'he') {
      return `${place}: ${temp}°C, ${desc}${typeof wind === 'number' ? `, רוח ${wind} קמ"ש` : ''}`;
   }

   return `the weather in ${place} : ${temp}°C, ${typeof wind === 'number' ? `, wind ${wind} km/h` : ''}`;
}
