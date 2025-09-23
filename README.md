# CineLink Backend

Backend API for the CineLink mobile app.

## Features

- Movie search and details from OMDB API
- Caching for improved performance
- Batch operations for multiple requests
- Movie recommendations
- Health check endpoints

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```
OMDB_API_KEY=your_omdb_api_key_here
PORT=5001
```

## Local Development

```bash
npm install
npm run dev
```

## Production

```bash
npm start
```

## API Endpoints

- GET `/api/health` - Health check
- GET `/api/test` - Test endpoint
- GET `/api/movies/search?q=query` - Search movies
- GET `/api/movies/details/:imdbID` - Movie details
- GET `/api/movies/season/:imdbID/:season` - Season details
- GET `/api/movies/episode/:imdbID/:season/:episode` - Episode details
- POST `/api/movies/batch-details` - Batch movie details
- POST `/api/recommendations` - Movie recommendations
