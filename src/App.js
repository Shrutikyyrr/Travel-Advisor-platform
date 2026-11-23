import React, { useEffect, useState } from 'react';
import { CssBaseline, Grid } from '@mui/material';
import { getPlacesData, getWeatherData } from './api/travelAdvisorAPI';
import List from './components/list/list';
import Map from './components/map/map';

const DEFAULT_COORDS = { lat: 28.6139, lng: 77.2090 };

const App = () => {
  const [places, setPlaces] = useState([]);
  const [coords, setCoords] = useState(DEFAULT_COORDS);
  const [bounds, setBounds] = useState(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState(null);
  const [rating, setRating] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [weatherData, setWeatherData] = useState(null);

  // Keep Delhi as the default map area instead of silently replacing it
  // with the browser's current geolocation.
  useEffect(() => {
    if (!bounds) return undefined;
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError('');

    const timeoutId = setTimeout(() => {
      getPlacesData(bounds.sw, bounds.ne, controller.signal)
        .then((data) => {
          if (!cancelled) {
            setPlaces(data);
            if (!data.length) setError('No restaurants were returned for this map area. Try zooming out or moving the map.');
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setPlaces([]);
            const details = err.response?.data?.details;
            const message = err.response?.data?.error || err.message;
            setError(details
              ? `${message} (${typeof details === 'string' ? details : JSON.stringify(details)})`
              : message || 'Could not load search results. Check the backend and API credentials.');
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => { cancelled = true; clearTimeout(timeoutId); controller.abort(); };
  }, [bounds]);

  useEffect(() => {
    let cancelled = false;
    getWeatherData(coords.lat, coords.lng)
      .then((data) => { if (!cancelled) setWeatherData(data); })
      .catch(() => { if (!cancelled) setWeatherData(null); });
    return () => { cancelled = true; };
  }, [coords.lat, coords.lng]);

  return (
    <>
      <CssBaseline />
      <Grid container spacing={2} sx={{ width: '100%', m: 0, p: 1 }}>
        <Grid item xs={12} md={4}>
          <List
            places={places}
            rating={rating}
            setRating={setRating}
            loading={loading}
            error={error}
          />
        </Grid>
        <Grid item xs={12} md={8} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Map
            places={places}
            setBounds={setBounds}
            setCoords={setCoords}
            coords={coords}
            weatherData={weatherData}
            selectedPlaceId={selectedPlaceId}
            onPlaceSelect={setSelectedPlaceId}
          />
        </Grid>
      </Grid>
    </>
  );
};

export default App;
