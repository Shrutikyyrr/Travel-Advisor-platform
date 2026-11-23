import axios from 'axios';

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001').replace(/\/$/, '');
const GEO_ID = process.env.REACT_APP_TRIPADVISOR_GEO_ID || '304551';

export const getPlacesData = async (sw, ne, signal) => {
  if (!sw || !ne) return [];

  try {
    const { data } = await axios.post(`${API_BASE_URL}/api/places`, {
      geoId: GEO_ID,
      type: 'restaurants',
      boundingBox: {
        northEastCorner: { latitude: ne.lat, longitude: ne.lng },
        southWestCorner: { latitude: sw.lat, longitude: sw.lng },
      },
    }, { signal });

    if (!Array.isArray(data?.places)) {
      throw new Error('The places API returned an unexpected response format.');
    }
    return data.places;
  } catch (error) {
    if (!error.response) {
      throw new Error(`Cannot reach the Travel Advisor backend at ${API_BASE_URL}. Start the server on port 5001 and check REACT_APP_API_BASE_URL.`);
    }
    throw error;
  }
};

export const getWeatherData = async (lat, lng) => {
  try {
    const { data } = await axios.get(`${API_BASE_URL}/api/weather`, { params: { lat, lng } });
    return data;
  } catch (error) {
    if (!error.response) {
      throw new Error(`Cannot reach the Travel Advisor backend at ${API_BASE_URL}.`);
    }
    throw error;
  }
};
