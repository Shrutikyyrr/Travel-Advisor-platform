import React from 'react';
import GoogleMapReact from 'google-map-react';
import { Paper, Typography, useMediaQuery, Alert } from '@mui/material';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import Rating from '@mui/material/Rating';
import useStyles from './styles.js';

const Marker = ({ place, matches, selected }) => {
  const classes = useStyles();
  if (!matches) return <LocationOnOutlinedIcon color="primary" fontSize="large" />;
  return (
    <Paper elevation={selected ? 8 : 3} className={classes.paper} sx={{ outline: selected ? '3px solid' : 'none', outlineColor: 'primary.main' }}>
      <Typography className={classes.typography} variant="subtitle2" gutterBottom>{place.name}</Typography>
      <img
        className={classes.pointer}
        alt={place.name || 'Place'}
        src={place.imageUrl || place.photo?.images?.small?.url || place.photo?.images?.large?.url || '/restaurant-placeholder.svg'}
        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/restaurant-placeholder.svg'; }}
      />
      <Rating size="small" value={Number(place.rating) || 0} readOnly />
    </Paper>
  );
};

const Map = ({ coords, places = [], setCoords, setBounds, weatherData, selectedPlaceId, onPlaceSelect }) => {
  const matches = useMediaQuery('(min-width:600px)');
  const classes = useStyles();
  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return <Alert severity="error">Missing REACT_APP_GOOGLE_MAPS_API_KEY. Add a restricted Google Maps key to your frontend environment file.</Alert>;
  }

  return (
    <div className={classes.mapContainer} style={{ position: 'relative' }}>
      {weatherData?.main && (
        <Paper elevation={3} sx={{ position: 'absolute', zIndex: 5, top: 12, left: 12, p: 1.5 }}>
          <Typography variant="subtitle2">{Math.round(weatherData.main.temp)}°C · {weatherData.weather?.[0]?.description}</Typography>
        </Paper>
      )}
      <GoogleMapReact
        bootstrapURLKeys={{ key: apiKey }}
        defaultCenter={coords}
        center={coords}
        defaultZoom={13}
        onChange={(event) => {
          setCoords({ lat: event.center.lat, lng: event.center.lng });
          if (event.bounds?.sw && event.bounds?.ne) {
            setBounds({ sw: event.bounds.sw, ne: event.bounds.ne });
          }
        }}
        onChildClick={(key) => onPlaceSelect?.(key)}
      >
        {places.filter((place) => place.latitude !== null && place.latitude !== undefined && place.longitude !== null && place.longitude !== undefined && Number.isFinite(Number(place.latitude)) && Number.isFinite(Number(place.longitude))).map((place, i) => (
          <div
            key={place.location_id || place.id || `${place.name}-${i}`}
            lat={Number(place.latitude)}
            lng={Number(place.longitude)}
          >
            <Marker place={place} matches={matches} selected={String(selectedPlaceId || '') === String(place.id || place.location_id)} />
          </div>
        ))}
        {weatherData?.weather?.[0]?.icon && (
          <div lat={coords.lat} lng={coords.lng}>
            <img
              alt={weatherData.weather[0].description || 'Current weather'}
              src={`https://openweathermap.org/img/wn/${weatherData.weather[0].icon}@2x.png`}
              height="60"
            />
          </div>
        )}
      </GoogleMapReact>
    </div>
  );
};

export default Map;
