const express = require('express');
const axios = require('axios');
const router = express.Router();

// Simple in-memory cache
const cache = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

const OMDB_API_KEY = process.env.OMDB_API_KEY || 'b5b4bac7';
const RECOMMENDATION_API_URL = 'https://movie-reco-api.onrender.com/recommend';

// Helper functions for cache
const getFromCache = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
};

const setCache = (key, data) => {
  cache.set(key, { data, timestamp: Date.now() });
};

router.post('/', async (req, res) => {
  try {
    const { title, top_n = 10 } = req.body;
    
    if (!title?.trim()) {
      return res.status(400).json({ error: 'Movie title required' });
    }

    const cacheKey = `reco_${title.toLowerCase().replace(/\s+/g, '_')}_${top_n}`;
    const cached = getFromCache(cacheKey);
    
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }

    // Get recommendations from ML API
    const recoResponse = await axios.post(RECOMMENDATION_API_URL, {
      titles: [title],
      top_n: Math.min(top_n, 20)
    }, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });

    const recommendations = recoResponse.data.recommendations || [];

    // Batch fetch OMDb details with concurrency limit
    const batchSize = 5;
    const detailedRecommendations = [];
    
    for (let i = 0; i < recommendations.length; i += batchSize) {
      const batch = recommendations.slice(i, i + batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (rec) => {
          try {
            const omdbResponse = await axios.get('https://www.omdbapi.com/', {
              params: {
                t: rec.title,
                y: rec.release_year,
                apikey: OMDB_API_KEY
              },
              timeout: 5000
            });

            if (omdbResponse.data.Response === 'True') {
              return {
                ...rec,
                imdbID: omdbResponse.data.imdbID,
                Poster: omdbResponse.data.Poster,
                imdbRating: omdbResponse.data.imdbRating,
                Runtime: omdbResponse.data.Runtime,
                Genre: omdbResponse.data.Genre
              };
            }
            return null;
          } catch (error) {
            console.error(`Error fetching OMDb details for ${rec.title}:`, error.message);
            return null;
          }
        })
      );

      const validResults = batchResults
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => result.value);
      
      detailedRecommendations.push(...validResults);
    }

    const result = {
      recommendations: detailedRecommendations,
      total: detailedRecommendations.length,
      source: title
    };

    setCache(cacheKey, result);
    res.json(result);

  } catch (error) {
    console.error('Recommendations error:', error.message);
    
    if (error.code === 'ECONNABORTED') {
      res.status(408).json({ error: 'Request timeout - recommendation service is slow' });
    } else if (error.response?.status >= 500) {
      res.status(503).json({ error: 'Recommendation service temporarily unavailable' });
    } else {
      res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
  }
});

module.exports = router;
    