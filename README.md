# Travel Advisor — corrected starter

This repository contains the React frontend and a small Express API proxy.

## Requirements
- Node.js 18+ and npm
- A Google Maps JavaScript API key with Maps JavaScript API enabled
- RapidAPI subscription to the configured Travel Advisor API
- An OpenWeather API key for current weather (optional)

## 1. Frontend setup

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and set `REACT_APP_GOOGLE_MAPS_API_KEY`. Restrict this browser key in Google Cloud Console by HTTP referrer and only the APIs you use. Browser keys are visible to users; never treat them as secrets.

```bash
npm install
npm start
```

## 2. Backend setup

Open a second terminal:

```bash
cd server
cp ../.env.example .env
npm install
npm start
```

Put your RapidAPI key and OpenWeather key in `server/.env`. Do not put them in React environment variables or commit the `.env` file.

The frontend calls `/api/places` and `/api/weather` on the backend. Set `REACT_APP_API_BASE_URL` in `.env.local` to `http://localhost:5001` for local development (the default). The backend permits `http://localhost:3000` and `http://localhost:3001`; set `CLIENT_ORIGIN` to a comma-separated list if you use other origins.

## Notes / provider configuration
- Restaurant search uses `POST https://<RAPIDAPI_HOST>/restaurants/v2/list` with a geoId and map bounding box. The backend logs a compact response shape and normalized count to help diagnose provider schema changes without logging restaurant payloads.
- Provider plans, endpoint availability, and response shapes can change. If the provider returns a different schema, adjust the response normalization in `server/index.js`.
- Weather requires `OPENWEATHER_API_KEY`; without it the frontend continues to work but weather is not shown.
- Saved places and itinerary entries are stored in this browser's localStorage. They are not synced across devices and are not user-account backed.
- The Directions button opens Google Maps directions for the selected destination; it does not calculate an in-app route.
- Do not deploy the Express server with permissive CORS. Set `CLIENT_ORIGIN` to your deployed frontend origin.

## Security action required
The original uploaded source contained a Google API key in frontend code and used it as the RapidAPI key. Treat that exposed key as compromised: rotate/restrict it in Google Cloud Console. Also inspect your original Git history for the exposed value and remove it from history before publishing. This corrected archive excludes `.git` and `node_modules`.
