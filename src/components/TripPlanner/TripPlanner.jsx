import React, { useEffect, useState } from 'react';
import { Accordion, AccordionSummary, AccordionDetails, Typography, List, ListItem, ListItemText, Button, Stack } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const readItems = (key) => {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
};

const TripPlanner = () => {
  const [saved, setSaved] = useState(() => readItems('travelAdvisorSavedPlaces'));
  const [itinerary, setItinerary] = useState(() => readItems('travelAdvisorItinerary'));

  useEffect(() => {
    const refresh = () => {
      setSaved(readItems('travelAdvisorSavedPlaces'));
      setItinerary(readItems('travelAdvisorItinerary'));
    };
    window.addEventListener('travelAdvisorStorageChange', refresh);
    return () => window.removeEventListener('travelAdvisorStorageChange', refresh);
  }, []);

  const clear = (key, setter) => {
    localStorage.removeItem(key);
    setter([]);
  };

  return (
    <Stack spacing={1} sx={{ mb: 2 }}>
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>My itinerary ({itinerary.length})</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {itinerary.length ? (
            <>
              <List dense>{itinerary.map((item, index) => <ListItem key={item.location_id || `${item.name}-${index}`}><ListItemText primary={item.name} secondary={item.address} /></ListItem>)}</List>
              <Button size="small" onClick={() => clear('travelAdvisorItinerary', setItinerary)}>Clear itinerary</Button>
            </>
          ) : <Typography color="text.secondary">Add places to your trip from the place cards.</Typography>}
        </AccordionDetails>
      </Accordion>
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Saved places ({saved.length})</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {saved.length ? (
            <>
              <List dense>{saved.map((item, index) => <ListItem key={item.location_id || `${item.name}-${index}`}><ListItemText primary={item.name} secondary={item.address} /></ListItem>)}</List>
              <Button size="small" onClick={() => clear('travelAdvisorSavedPlaces', setSaved)}>Clear saved places</Button>
            </>
          ) : <Typography color="text.secondary">Save places from the place cards to find them here.</Typography>}
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
};

export default TripPlanner;
