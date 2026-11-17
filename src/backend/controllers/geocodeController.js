/**
 * Geocoding Controller using OpenStreetMap Nominatim API
 * Provides real-world location search worldwide without API keys.
 */

const http = require('http');
const https = require('https');

function searchLocation(req, res) {
  const query = req.query.q || req.query.query || '';
  if (!query || query.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Query parameter "q" is required.' });
  }

  const encodedQuery = encodeURIComponent(query.trim());
  const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&limit=6&addressdetails=1`;

  const options = {
    headers: {
      'User-Agent': 'AI-Traffic-Monitoring-System/1.0 (Student Project Platform)',
      'Accept-Language': 'en'
    }
  };

  https.get(nominatimUrl, options, (apiRes) => {
    let rawData = '';
    apiRes.on('data', chunk => rawData += chunk);
    apiRes.on('end', () => {
      try {
        const results = JSON.parse(rawData);
        if (!Array.isArray(results) || results.length === 0) {
          return res.json({
            success: false,
            error: 'Location not found. Please try a different location name or address.',
            results: []
          });
        }

        const formattedResults = results.map(item => {
          const name = item.name || item.display_name.split(',')[0];
          return {
            displayName: item.display_name,
            name: name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            type: item.type || item.class || 'location',
            importance: item.importance || 0
          };
        });

        return res.json({
          success: true,
          query: query.trim(),
          count: formattedResults.length,
          results: formattedResults
        });
      } catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to parse geocoding response.' });
      }
    });
  }).on('error', (err) => {
    return res.status(500).json({ success: false, error: `Geocoding service network error: ${err.message}` });
  });
}

module.exports = {
  searchLocation
};
