const express = require("express");
const axios = require("axios");
const router = express.Router();

// Simple in-memory cache
const cache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

const OMDB_API_KEY = process.env.OMDB_API_KEY || "b5b4bac7";
const OMDB_BASE_URL = "https://www.omdbapi.com/";

// Helper functions
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

// Search movies with caching
router.get("/search", async (req, res) => {
  try {
    const { q: query } = req.query;
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: "Query parameter required" });
    }

    const trimmedQuery = query.trim();
    const cacheKey = `search_${trimmedQuery.toLowerCase()}`;

    const cached = getFromCache(cacheKey);
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }

    let url;
    if (trimmedQuery.length < 3) {
      url = `${OMDB_BASE_URL}?t=${encodeURIComponent(
        trimmedQuery
      )}&apikey=${OMDB_API_KEY}`;
    } else {
      url = `${OMDB_BASE_URL}?s=${encodeURIComponent(
        trimmedQuery
      )}&apikey=${OMDB_API_KEY}`;
    }

    const response = await axios.get(url, { timeout: 5000 });
    const data = response.data;

    if (data.Response === "False") {
      const result = { Search: [], totalResults: 0, error: data.Error };
      setCache(cacheKey, result);
      return res.json(result);
    }

    const result =
      trimmedQuery.length < 3
        ? { Search: [data], totalResults: 1 }
        : { Search: data.Search || [], totalResults: data.totalResults || 0 };

    setCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error("Search error:", error.message);
    res.status(500).json({ error: "Search service temporarily unavailable" });
  }
});

// Movie details with caching
router.get("/details/:imdbID", async (req, res) => {
  try {
    const { imdbID } = req.params;
    const cacheKey = `details_${imdbID}`;

    const cached = getFromCache(cacheKey);
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }

    const response = await axios.get(OMDB_BASE_URL, {
      params: {
        i: imdbID,
        apikey: OMDB_API_KEY,
        plot: "full",
      },
      timeout: 5000,
    });

    const data = response.data;
    if (data.Response === "False") {
      return res.status(404).json({ error: data.Error || "Movie not found" });
    }

    setCache(cacheKey, data);
    res.json(data);
  } catch (error) {
    console.error("Details error:", error.message);
    res.status(500).json({ error: "Movie details service temporarily unavailable" });
  }
});

// Season details
router.get("/season/:imdbID/:season", async (req, res) => {
  try {
    const { imdbID, season } = req.params;
    const cacheKey = `season_${imdbID}_${season}`;

    const cached = getFromCache(cacheKey);
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }

    const response = await axios.get(OMDB_BASE_URL, {
      params: {
        i: imdbID,
        Season: season,
        apikey: OMDB_API_KEY,
      },
      timeout: 5000,
    });

    const data = response.data;
    if (data.Response === "False") {
      return res.status(404).json({ error: data.Error || "Season not found" });
    }

    setCache(cacheKey, data);
    res.json(data);
  } catch (error) {
    console.error("Season details error:", error.message);
    res.status(500).json({ error: "Season details service temporarily unavailable" });
  }
});

// Episode details
router.get("/episode/:imdbID/:season/:episode", async (req, res) => {
  try {
    const { imdbID, season, episode } = req.params;
    const cacheKey = `episode_${imdbID}_${season}_${episode}`;

    const cached = getFromCache(cacheKey);
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }

    const response = await axios.get(OMDB_BASE_URL, {
      params: {
        i: imdbID,
        Season: season,
        Episode: episode,
        apikey: OMDB_API_KEY,
      },
      timeout: 5000,
    });

    const data = response.data;
    if (data.Response === "False") {
      return res.status(404).json({ error: data.Error || "Episode not found" });
    }

    setCache(cacheKey, data);
    res.json(data);
  } catch (error) {
    console.error("Episode details error:", error.message);
    res.status(500).json({ error: "Episode details service temporarily unavailable" });
  }
});

// Batch movie details
router.post("/batch-details", async (req, res) => {
  try {
    const { imdbIDs } = req.body;
    if (!Array.isArray(imdbIDs) || imdbIDs.length === 0) {
      return res.status(400).json({ error: "imdbIDs array required" });
    }

    const results = await Promise.allSettled(
      imdbIDs.slice(0, 10).map(async (imdbID) => {
        const cacheKey = `details_${imdbID}`;
        const cached = getFromCache(cacheKey);

        if (cached) return { imdbID, data: cached, fromCache: true };

        const response = await axios.get(OMDB_BASE_URL, {
          params: { i: imdbID, apikey: OMDB_API_KEY, plot: "full" },
          timeout: 5000,
        });

        if (response.data.Response === "True") {
          setCache(cacheKey, response.data);
          return { imdbID, data: response.data };
        }

        return { imdbID, error: response.data.Error };
      })
    );

    const processedResults = results.map((result) =>
      result.status === "fulfilled"
        ? result.value
        : { error: result.reason.message }
    );

    res.json({ results: processedResults });
  } catch (error) {
    console.error("Batch details error:", error.message);
    res.status(500).json({ error: "Batch service temporarily unavailable" });
  }
});

module.exports = router;
        
