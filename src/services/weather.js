const WEATHER_BASE = 'https://api.open-meteo.com/v1/forecast';
const GEO_TIMEOUT_MS = 7000;
const FALLBACK_LOCATION = {
  latitude: 13.1067,
  longitude: 80.097,
  label: 'Avadi, Chennai',
  source: 'fallback',
};

function getBrowserPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not supported by this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        label: 'Current location',
        source: 'browser',
      }),
      reject,
      { enableHighAccuracy: false, timeout: GEO_TIMEOUT_MS, maximumAge: 30 * 60 * 1000 }
    );
  });
}

export async function getUserLocation() {
  try {
    return await getBrowserPosition();
  } catch {
    return FALLBACK_LOCATION;
  }
}

export function detectSeason({ temperature, rain = 0, humidity = 0, date = new Date() }) {
  const month = date.getMonth() + 1;
  const monsoonMonth = month >= 6 && month <= 11;

  if ((monsoonMonth && (rain > 0 || humidity >= 72)) || rain >= 1) {
    return 'monsoon';
  }
  if (temperature >= 30 || (month >= 3 && month <= 5)) {
    return 'summer';
  }
  if (temperature <= 22 || month === 12 || month <= 2) {
    return 'winter';
  }
  return 'mild';
}

export async function getCurrentWeather(location) {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: 'temperature_2m,relative_humidity_2m,rain,precipitation,weather_code',
    timezone: 'auto',
  });

  const response = await fetch(`${WEATHER_BASE}?${params}`);
  if (!response.ok) {
    throw new Error('Unable to load current weather.');
  }

  const data = await response.json();
  const current = data.current || {};
  const temperature = Math.round(Number(current.temperature_2m || 0));
  const humidity = Math.round(Number(current.relative_humidity_2m || 0));
  const rain = Number(current.rain || current.precipitation || 0);

  return {
    location,
    temperature,
    humidity,
    rain,
    season: detectSeason({ temperature, humidity, rain }),
    fetchedAt: current.time || new Date().toISOString(),
  };
}

export async function getWeatherContext() {
  const location = await getUserLocation();
  return getCurrentWeather(location);
}

export function describeWeatherContext(weather) {
  if (!weather) return 'Weather unavailable';
  const rainText = weather.rain > 0 ? `Rain ${weather.rain}mm` : 'No rain';
  return `${weather.temperature}°C · ${weather.humidity}% humidity · ${rainText} · ${weather.season}`;
}
