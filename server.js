const express = require("express");
const cors = require("cors");
const axios = require("axios");
const NodeCache = require("node-cache");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5001;

// Cache for 5 minutes
const cache = new NodeCache({ stdTTL: 300 });

// Middleware
app.use(cors());
app.use(express.json());

// OMDB API configuration
const OMDB_API_KEY = process.env.OMDB_API_KEY;
const OMDB_BASE_URL = "https://www.omdbapi.com";

// Health check endpoints
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

app.get("/api/test", (req, res) => {
  res.json({
    message: "CineLink Backend is running!",
    timestamp: new Date().toISOString(),
  });
});

// Movie search endpoint
app.get("/api/movies/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: "Query parameter is required" });
    }

    const cacheKey = `search_${q}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const trimmedQuery = q.trim();
    const searchType = trimmedQuery.length < 3 ? "t" : "s";

    const response = await axios.get(OMDB_BASE_URL, {
      params: {
        [searchType]: trimmedQuery,
        apikey: OMDB_API_KEY,
      },
    });

    const result = response.data;
    if (result.Response === "False") {
      return res.json({ Search: [] });
    }

    const searchData = searchType === "t" ? { Search: [result] } : result;
    cache.set(cacheKey, searchData);

    res.json(searchData);
  } catch (error) {
    console.error("Search error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Movie details endpoint
app.get("/api/movies/details/:imdbID", async (req, res) => {
  try {
    const { imdbID } = req.params;

    const cacheKey = `details_${imdbID}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const response = await axios.get(OMDB_BASE_URL, {
      params: {
        i: imdbID,
        apikey: OMDB_API_KEY,
        plot: "full",
      },
    });

    const result = response.data;
    if (result.Response === "False") {
      return res.status(404).json({ error: result.Error });
    }

    cache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error("Details error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Season details endpoint
app.get("/api/movies/season/:imdbID/:season", async (req, res) => {
  try {
    const { imdbID, season } = req.params;

    const cacheKey = `season_${imdbID}_${season}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const response = await axios.get(OMDB_BASE_URL, {
      params: {
        i: imdbID,
        Season: season,
        apikey: OMDB_API_KEY,
      },
    });

    const result = response.data;
    if (result.Response === "False") {
      return res.status(404).json({ error: result.Error });
    }

    cache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error("Season details error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Episode details endpoint
app.get("/api/movies/episode/:imdbID/:season/:episode", async (req, res) => {
  try {
    const { imdbID, season, episode } = req.params;

    const cacheKey = `episode_${imdbID}_${season}_${episode}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const response = await axios.get(OMDB_BASE_URL, {
      params: {
        i: imdbID,
        Season: season,
        Episode: episode,
        apikey: OMDB_API_KEY,
      },
    });

    const result = response.data;
    if (result.Response === "False") {
      return res.status(404).json({ error: result.Error });
    }

    cache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error("Episode details error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Batch movie details endpoint
app.post("/api/movies/batch-details", async (req, res) => {
  try {
    const { imdbIDs } = req.body;
    if (!Array.isArray(imdbIDs)) {
      return res.status(400).json({ error: "imdbIDs must be an array" });
    }

    const results = await Promise.allSettled(
      imdbIDs.map(async (imdbID) => {
        const cacheKey = `details_${imdbID}`;
        const cached = cache.get(cacheKey);
        if (cached) {
          return { imdbID, data: cached, error: null };
        }

        try {
          const response = await axios.get(OMDB_BASE_URL, {
            params: {
              i: imdbID,
              apikey: OMDB_API_KEY,
              plot: "full",
            },
          });

          const result = response.data;
          if (result.Response === "False") {
            return { imdbID, data: null, error: result.Error };
          }

          cache.set(cacheKey, result);
          return { imdbID, data: result, error: null };
        } catch (error) {
          return { imdbID, data: null, error: error.message };
        }
      })
    );

    const processedResults = results.map((result) =>
      result.status === "fulfilled"
        ? result.value
        : { imdbID: null, data: null, error: "Request failed" }
    );

    res.json({ results: processedResults });
  } catch (error) {
    console.error("Batch details error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Recommendations endpoint
app.post("/api/recommendations", async (req, res) => {
  try {
    const { title, top_n = 10 } = req.body;

    const cacheKey = `recommendations_${title}_${top_n}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Use external recommendation API
    const response = await axios.post(
      "https://movie-reco-api.onrender.com/recommend",
      {
        titles: [title],
        top_n: parseInt(top_n),
      }
    );

    const recommendations = response.data.recommendations || [];

    // Get OMDB details for recommendations
    const detailedRecommendations = await Promise.allSettled(
      recommendations.slice(0, top_n).map(async (rec) => {
        try {
          const omdbResponse = await axios.get(OMDB_BASE_URL, {
            params: {
              t: rec.title,
              y: rec.release_year,
              apikey: OMDB_API_KEY,
            },
          });

          const omdbData = omdbResponse.data;
          if (omdbData.Response === "True") {
            return {
              ...rec,
              imdbID: omdbData.imdbID,
              Poster: omdbData.Poster,
              imdbRating: omdbData.imdbRating,
              Runtime: omdbData.Runtime,
            };
          }
          return null;
        } catch (error) {
          return null;
        }
      })
    );

    const validRecommendations = detailedRecommendations
      .filter((result) => result.status === "fulfilled" && result.value)
      .map((result) => result.value);

    const result = { recommendations: validRecommendations };
    cache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error("Recommendations error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 CineLink Backend running on port ${PORT}`);
  console.log(`📱 Health check: http://localhost:${PORT}/api/health`);
});
