import React from 'react';
import {
  CircularProgress, Grid, Typography, InputLabel, MenuItem,
  FormControl, Select, Alert, Box,
} from '@mui/material';
import PlaceDetails from '../PlaceDetails/PlaceDetails';
import TripPlanner from '../TripPlanner/TripPlanner';
import useStyles from './styles.js';

const List = ({ places = [], rating, setRating, loading, error }) => {
  const classes = useStyles();
  const filteredPlaces = places.filter((place) => Number(place.rating || 0) >= Number(rating || 0));

  return (
    <div className={classes.container}>
      <Typography variant="h4" gutterBottom>Restaurants around you</Typography>
      <TripPlanner />
      <FormControl className={classes.formControl} size="small">
        <InputLabel id="rating-label">Rating</InputLabel>
        <Select labelId="rating-label" label="Rating" value={rating} onChange={(e) => setRating(Number(e.target.value))}>
          <MenuItem value={0}>All ratings</MenuItem>
          <MenuItem value={3}>Above 3.0</MenuItem>
          <MenuItem value={4}>Above 4.0</MenuItem>
          <MenuItem value={4.5}>Above 4.5</MenuItem>
        </Select>
      </FormControl>
      {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}
      <Grid container spacing={3} className={classes.list}>
        {loading ? (
          <Grid item xs={12}><Box className={classes.loading}><CircularProgress /></Box></Grid>
        ) : filteredPlaces.length ? (
          filteredPlaces.map((place) => (
            <Grid item key={place.location_id || `${place.name}-${place.latitude}-${place.longitude}`} xs={12}>
              <PlaceDetails place={place} />
            </Grid>
          ))
        ) : (
          <Grid item xs={12}>
            <Typography color="text.secondary">
              {places.length ? 'No places match this rating.' : 'No restaurants found in this map area. Move or zoom the map to search again.'}
            </Typography>
          </Grid>
        )}
      </Grid>
    </div>
  );
};

export default List;
