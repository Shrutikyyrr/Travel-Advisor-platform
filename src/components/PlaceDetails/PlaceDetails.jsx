import React, { useState } from 'react';
import {
  Box, Typography, Button, Card, CardMedia, CardContent, CardActions, Chip,
} from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PhoneIcon from '@mui/icons-material/Phone';
import Rating from '@mui/material/Rating';
import useStyles from './styles.js';

const placeKey = (item) => item.location_id || `${item.name || ''}-${item.latitude || ''}-${item.longitude || ''}`;
const RESTAURANT_PLACEHOLDER = '/restaurant-placeholder.svg';

const priceLevelLabels = {
  '$': 'Budget-friendly',
  '$$': 'Moderate',
  '$$$': 'Expensive',
  '$$$$': 'Premium',
  '₹': 'Budget-friendly',
  '₹₹': 'Moderate',
  '₹₹₹': 'Expensive',
  '₹₹₹₹': 'Premium',
};

const getPriceLabel = (place) => {
  if (place.price_range) return `Price range: ${place.price_range}`;
  if (place.price) return `Price: ${place.price}`;
  if (place.price_level) {
    const level = String(place.price_level).trim();
    const category = priceLevelLabels[level];
    return `Price level: ${level}${category ? ` · ${category}` : ''}`;
  }
  return 'Price unavailable';
};

const PlaceDetails = ({ place }) => {
  const classes = useStyles();
  const [saved, setSaved] = useState(() => {
    try {
      const savedPlaces = JSON.parse(localStorage.getItem('travelAdvisorSavedPlaces') || '[]');
      return savedPlaces.some((item) => item.location_id === place.location_id);
    } catch { return false; }
  });
  const [inItinerary, setInItinerary] = useState(() => {
    try {
      const items = JSON.parse(localStorage.getItem('travelAdvisorItinerary') || '[]');
      return items.some((item) => placeKey(item) === placeKey(place));
    } catch { return false; }
  });
  const [imageFailed, setImageFailed] = useState(false);

  const toggleItinerary = () => {
    try {
      const current = JSON.parse(localStorage.getItem('travelAdvisorItinerary') || '[]');
      const exists = current.some((item) => placeKey(item) === placeKey(place));
      const next = exists
        ? current.filter((item) => placeKey(item) !== placeKey(place))
        : [...current, {
            location_id: place.location_id, name: place.name, address: place.address,
            latitude: place.latitude, longitude: place.longitude,
          }];
      localStorage.setItem('travelAdvisorItinerary', JSON.stringify(next));
      setInItinerary(!exists);
      window.dispatchEvent(new Event('travelAdvisorStorageChange'));
    } catch {
      window.alert('Could not update your itinerary in browser storage.');
    }
  };

  const toggleSaved = () => {
    try {
      const current = JSON.parse(localStorage.getItem('travelAdvisorSavedPlaces') || '[]');
      const exists = current.some((item) => placeKey(item) === placeKey(place));
      const next = exists
        ? current.filter((item) => placeKey(item) !== placeKey(place))
        : [...current, {
            location_id: place.location_id,
            name: place.name,
            address: place.address,
            latitude: place.latitude,
            longitude: place.longitude,
            rating: place.rating,
            web_url: place.web_url,
            booking_url: place.booking_url,
            price: place.price,
            price_level: place.price_level,
            price_range: place.price_range,
          }];
      localStorage.setItem('travelAdvisorSavedPlaces', JSON.stringify(next));
      setSaved(!exists);
      window.dispatchEvent(new Event('travelAdvisorStorageChange'));
    } catch {
      window.alert('Could not save this place in browser storage.');
    }
  };

  const imageUrl = imageFailed
    ? RESTAURANT_PLACEHOLDER
    : place.imageUrl || place.photo?.images?.large?.url || place.photo?.images?.original?.url ||
      place.photo?.images?.medium?.url || place.photo?.images?.small?.url || RESTAURANT_PLACEHOLDER;
  const openExternal = (url) => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };
  const bookingUrl = /^https?:\/\//i.test(place.booking_url || '') ? place.booking_url : null;
  const tripadvisorUrl = /^https?:\/\//i.test(place.web_url || '') ? place.web_url : null;

  return (
    <Card elevation={3}>
      <CardMedia
        component="img"
        loading="lazy"
        sx={{ width: '100%', height: 220, aspectRatio: '16 / 9', objectFit: 'cover', bgcolor: '#f5efe6' }}
        image={imageUrl}
        alt={place.name ? `${place.name} restaurant` : 'Restaurant image'}
        title={place.name || 'Restaurant'}
        onError={() => setImageFailed(true)}
      />
      <CardContent>
        <Typography gutterBottom variant="h5">{place.name || 'Unnamed place'}</Typography>
        <Box display="flex" justifyContent="space-between" alignItems="center" my={2}>
          <Rating value={Number(place.rating) || 0} readOnly precision={0.5} />
          <Typography component="span">{place.num_reviews || 0} reviews</Typography>
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>{getPriceLabel(place)}</Typography>
        {place.ranking && <Typography variant="body2">Ranking: {place.ranking}</Typography>}
        {place.awards?.map((award, index) => (
          <Box key={`${award.display_name || 'award'}-${index}`} display="flex" gap={1} my={1} alignItems="center">
            {award.images?.small && <img src={award.images.small} alt="" width="28" />}
            <Typography variant="caption">{award.display_name}</Typography>
          </Box>
        ))}
        {place.cuisine?.map(({ name }) => <Chip key={name} size="small" label={name} className={classes.chip} />)}
        <Typography variant="body2" color="text.secondary" className={classes.subtitle}>
          <LocationOnIcon fontSize="small" />{place.address || 'Address unavailable'}
        </Typography>
        {place.phone && <Typography variant="body2" color="text.secondary" className={classes.spacing}><PhoneIcon fontSize="small" />{place.phone}</Typography>}
      </CardContent>
      <CardActions>
        <Button size="small" onClick={toggleSaved}>{saved ? 'Remove saved' : 'Save place'}</Button>
        <Button size="small" onClick={toggleItinerary}>{inItinerary ? 'Remove from trip' : 'Add to trip'}</Button>
        {bookingUrl && <Button size="small" onClick={() => openExternal(bookingUrl)}>{place.booking_label || 'Book / reserve'}</Button>}
        {place.latitude && place.longitude && (
          <Button size="small" onClick={() => openExternal(`https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`)}>
            Directions
          </Button>
        )}
        {tripadvisorUrl && <Button size="small" onClick={() => openExternal(tripadvisorUrl)}>Tripadvisor</Button>}
        {place.website && <Button size="small" onClick={() => openExternal(place.website)}>Website</Button>}
      </CardActions>
    </Card>
  );
};

export default PlaceDetails;
