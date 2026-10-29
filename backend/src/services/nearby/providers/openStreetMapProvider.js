// ─────────────────────────────────────────────────────────────
//  backend/src/services/nearby/providers/openStreetMapProvider.js
//  OpenStreetMap & Mock Geocoding / POI Providers for FoodieBite
// ─────────────────────────────────────────────────────────────

const USER_AGENT = 'FoodieBite/1.0 (contact: sham111205s@gmail.com)';

let fetchInstance = global.fetch;
if (!fetchInstance) {
  try {
    fetchInstance = require('node-fetch');
  } catch (err) {
    console.warn('[OSM Provider] global.fetch is not available and node-fetch could not be loaded.');
  }
}

// ── Rate Limiter / Query Queue for Public OSM Services ────────
class QueryQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.lastQueryTime = 0;
  }

  async enqueue(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.processing) return;
    if (this.queue.length === 0) return;

    this.processing = true;
    const { fn, resolve, reject } = this.queue.shift();

    try {
      const now = Date.now();
      const timeSinceLast = now - this.lastQueryTime;
      const minDelay = 1000; // Enforce 1-second delay between OSM calls
      if (timeSinceLast < minDelay) {
        await new Promise(r => setTimeout(r, minDelay - timeSinceLast));
      }

      const result = await fn();
      this.lastQueryTime = Date.now();
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      this.processing = false;
      this.process();
    }
  }
}

const osmQueue = new QueryQueue();

// Helper to calculate Haversine distance in km
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

// ── Real OpenStreetMap / Overpass Provider ────────────────────
class OpenStreetMapProvider {
  constructor() {
    this.sourceName = 'openstreetmap';
  }

  /**
   * Geocode a text address to lat/lng using Nominatim
   */
  async geocode(queryText) {
    return osmQueue.enqueue(async () => {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryText)}&limit=1`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      try {
        const res = await fetchInstance(url, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/json'
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          if (res.status === 429) {
            throw new Error('OSM Nominatim rate limit exceeded.');
          }
          throw new Error(`Nominatim returned error status ${res.status}`);
        }

        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const match = data[0];
          return {
            lat: parseFloat(match.lat),
            lng: parseFloat(match.lon),
            address: match.display_name
          };
        }
        return null;
      } catch (err) {
        console.warn('[OSM Provider] Geocode failed:', err.message);
        throw err;
      }
    });
  }

  /**
   * Search for nearby restaurants/cafes using Overpass API
   */
  async searchNearby({ lat, lng, radius }) {
    return osmQueue.enqueue(async () => {
      const overpassUrl = 'https://overpass-api.de/api/interpreter';
      // Query nodes and ways containing restaurant-like amenities around the coordinate
      const query = `[out:json][timeout:15];
(
  node["amenity"~"restaurant|cafe|bakery|fast_food"](around:${radius},${lat},${lng});
  way["amenity"~"restaurant|cafe|bakery|fast_food"](around:${radius},${lat},${lng});
);
out center;`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

      try {
        const res = await fetchInstance(overpassUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': USER_AGENT
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          if (res.status === 429) {
            throw new Error('OSM Overpass rate limit exceeded.');
          }
          throw new Error(`Overpass returned error status ${res.status}`);
        }

        const data = await res.json();
        const elements = data.elements || [];

        // Normalize elements
        return elements.map(el => {
          const tags = el.tags || {};
          const itemLat = el.lat || (el.center && el.center.lat);
          const itemLng = el.lon || (el.center && el.center.lon);
          const distance = calculateDistance(lat, lng, itemLat, itemLng);

          // Build a clean address from details
          const addressParts = [
            tags['addr:housenumber'],
            tags['addr:street'],
            tags['addr:suburb'],
            tags['addr:city'],
            tags['addr:postcode']
          ].filter(Boolean);
          const address = addressParts.length > 0 ? addressParts.join(', ') : (tags['addr:full'] || null);

          // Extract dietary tags if present
          const dietaryTags = [];
          if (tags['diet:vegetarian'] === 'yes' || tags['diet:vegetarian'] === 'only' || tags['cuisine']?.toLowerCase().includes('vegetarian')) {
            dietaryTags.push('vegetarian');
          }
          if (tags['diet:vegan'] === 'yes' || tags['diet:vegan'] === 'only' || tags['cuisine']?.toLowerCase().includes('vegan')) {
            dietaryTags.push('vegan');
          }
          if (tags['diet:gluten_free'] === 'yes') {
            dietaryTags.push('gluten-free');
          }

          // Format price level: $ = 1, $$ = 2, $$$ = 3, $$$$ = 4
          let priceLevel = null;
          if (tags['price_level']) {
            priceLevel = parseInt(tags['price_level'], 10);
          } else if (tags['price']) {
            priceLevel = tags['price'].length;
          }

          return {
            id: `osm_${el.type}_${el.id}`,
            name: tags.name || 'Unnamed Place',
            category: tags.amenity || 'restaurant',
            cuisine: tags.cuisine || null,
            latitude: itemLat,
            longitude: itemLng,
            address,
            distance,
            phone: tags.phone || tags['contact:phone'] || null,
            website: tags.website || tags['contact:website'] || null,
            openingHours: tags.opening_hours || null,
            isOpen: null, // OSM tags can't easily calculate isOpen reliably on backend without heavy parsing
            rating: tags.rating ? parseFloat(tags.rating) : null,
            priceLevel,
            dietaryTags,
            source: 'openstreetmap',
            sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
            _rawTags: tags // Keep reference for ranking checks
          };
        });
      } catch (err) {
        console.warn('[OSM Provider] Search failed:', err.message);
        throw err;
      }
    });
  }
}

// ── Mock Geocoding / POI Provider for Offline & Tests ────────
class MockNearbyProvider {
  constructor() {
    this.sourceName = 'mock';
    this.mockPlaces = [
      {
        id: 'mock_node_1',
        name: 'A2B - Adyar Ananda Bhavan',
        category: 'restaurant',
        cuisine: 'south_indian;indian;vegetarian',
        latitude: 13.1171,
        longitude: 80.1022,
        address: '15, Poonamallee High Rd, Avadi, Chennai, Tamil Nadu 600054',
        phone: '+91 44 2638 1234',
        website: 'https://www.aabsweets.com',
        openingHours: 'Mo-Su 07:00-22:30',
        isOpen: true,
        rating: 4.2,
        priceLevel: 1,
        dietaryTags: ['vegetarian'],
        source: 'mock',
        sourceUrl: 'https://www.openstreetmap.org/node/mock1',
        _rawTags: { cuisine: 'south_indian;indian;vegetarian', 'diet:vegetarian': 'yes' }
      },
      {
        id: 'mock_node_2',
        name: 'Anjappar Chettinad Restaurant',
        category: 'restaurant',
        cuisine: 'chettinad;indian;south_indian',
        latitude: 13.1152,
        longitude: 80.0985,
        address: '56, NM Road, Avadi, Chennai, Tamil Nadu 600054',
        phone: '+91 44 2638 5678',
        website: 'http://www.anjappar.com',
        openingHours: 'Mo-Su 11:30-23:00',
        isOpen: true,
        rating: 4.0,
        priceLevel: 2,
        dietaryTags: [],
        source: 'mock',
        sourceUrl: 'https://www.openstreetmap.org/node/mock2',
        _rawTags: { cuisine: 'chettinad;indian;south_indian' }
      },
      {
        id: 'mock_node_3',
        name: 'Saravana Bhavan',
        category: 'restaurant',
        cuisine: 'south_indian;vegetarian',
        latitude: 13.1210,
        longitude: 80.1050,
        address: 'Block A, Avadi Market Street, Chennai 600054',
        phone: '+91 44 2638 9999',
        website: null,
        openingHours: 'Mo-Su 06:30-22:00',
        isOpen: true,
        rating: 4.4,
        priceLevel: 1,
        dietaryTags: ['vegetarian'],
        source: 'mock',
        sourceUrl: 'https://www.openstreetmap.org/node/mock3',
        _rawTags: { cuisine: 'south_indian;vegetarian', 'diet:vegetarian': 'only' }
      },
      {
        id: 'mock_node_4',
        name: 'Sangeetha Veg Restaurant',
        category: 'restaurant',
        cuisine: 'indian;vegetarian;chinese',
        latitude: 13.1250,
        longitude: 80.0950,
        address: '100 Feet Bypass Road, Avadi, Chennai 600054',
        phone: null,
        website: 'https://sangeethaveg.com',
        openingHours: 'Mo-Su 07:00-22:30',
        isOpen: true,
        rating: 4.1,
        priceLevel: 2,
        dietaryTags: ['vegetarian'],
        source: 'mock',
        sourceUrl: 'https://www.openstreetmap.org/node/mock4',
        _rawTags: { cuisine: 'indian;vegetarian;chinese', 'diet:vegetarian': 'yes' }
      },
      {
        id: 'mock_node_5',
        name: 'Hot Breads Cafe',
        category: 'cafe',
        cuisine: 'bakery;cafe;fast_food',
        latitude: 13.1165,
        longitude: 80.1005,
        address: 'Gandhi Irwin Road, Avadi, Chennai 600054',
        phone: '+91 44 2638 0000',
        website: 'http://hotbreads.in',
        openingHours: 'Mo-Su 09:00-21:30',
        isOpen: true,
        rating: 3.8,
        priceLevel: 2,
        dietaryTags: [],
        source: 'mock',
        sourceUrl: 'https://www.openstreetmap.org/node/mock5',
        _rawTags: { cuisine: 'bakery;cafe;fast_food' }
      },
      {
        id: 'mock_node_6',
        name: 'McDonald\'s Fast Food',
        category: 'fast_food',
        cuisine: 'burger;fast_food;american',
        latitude: 13.1110,
        longitude: 80.1110,
        address: 'Avadi Main Rd, Chennai 600054',
        phone: null,
        website: 'https://mcdonaldsindia.com',
        openingHours: 'Mo-Su 10:00-23:00',
        isOpen: true,
        rating: 3.9,
        priceLevel: 2,
        dietaryTags: [],
        source: 'mock',
        sourceUrl: 'https://www.openstreetmap.org/node/mock6',
        _rawTags: { cuisine: 'burger;fast_food;american' }
      },
      {
        id: 'mock_node_7',
        name: 'Chinese Wok',
        category: 'restaurant',
        cuisine: 'chinese;asian',
        latitude: 13.1360,
        longitude: 80.1210,
        address: 'GVR Complex, Avadi High Road, Chennai 600054',
        phone: '+91 44 2638 8888',
        website: null,
        openingHours: 'Mo-Su 11:30-22:30',
        isOpen: true,
        rating: 3.7,
        priceLevel: 2,
        dietaryTags: [],
        source: 'mock',
        sourceUrl: 'https://www.openstreetmap.org/node/mock7',
        _rawTags: { cuisine: 'chinese;asian' }
      }
    ];
  }

  async geocode(queryText) {
    const q = queryText.toLowerCase().trim();
    if (q.includes('avadi') || q.includes('chennai')) {
      return {
        lat: 13.116,
        lng: 80.101,
        address: 'Avadi, Chennai, Tamil Nadu, India'
      };
    }
    if (q.includes('mumbai') || q.includes('bandra')) {
      return {
        lat: 19.0596,
        lng: 72.8295,
        address: 'Bandra, Mumbai, Maharashtra, India'
      };
    }
    // Unknown fallback
    return {
      lat: 13.116,
      lng: 80.101,
      address: `${queryText}, Geocoded (Fallback Mock Location)`
    };
  }

  async searchNearby({ lat, lng, radius }) {
    // Filter and compute distances for mock places
    return this.mockPlaces.map(place => {
      const distance = calculateDistance(lat, lng, place.latitude, place.longitude);
      return {
        ...place,
        distance
      };
    }).filter(place => place.distance <= radius / 1000); // Filter by radius in km
  }
}

// ── Broken Provider for Error State Testing ────────────────────
class BrokenNearbyProvider {
  constructor() {
    this.sourceName = 'broken';
  }

  async geocode(queryText) {
    throw new Error('BrokenNearbyProvider: geocode deliberately fails for testing.');
  }

  async searchNearby({ lat, lng, radius }) {
    throw new Error('BrokenNearbyProvider: searchNearby deliberately fails for testing.');
  }
}

module.exports = {
  OpenStreetMapProvider,
  MockNearbyProvider,
  BrokenNearbyProvider,
  calculateDistance
};
