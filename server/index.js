require("dotenv").config();

const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = Number(process.env.PORT) || 5001;
const CLIENT_ORIGINS = new Set([
  "http://localhost:3000",
  "http://localhost:3001",
  ...(process.env.CLIENT_ORIGIN || "").split(","),
].map((origin) => origin.trim()).filter(Boolean));
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || "travel-advisor.p.rapidapi.com";

app.use(cors({
  origin(origin, callback) {
    // Allow non-browser clients (curl/health checks) and the configured local UI origins.
    if (!origin || CLIENT_ORIGINS.has(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
  },
}));
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.json({ message: "Travel Advisor API is running" });
});

// Tripadvisor's v2/list response is nested. Extract restaurant records
// from any nested arrays/objects instead of assuming response.data.places.
function extractPlaces(payload) {
  const found = [];
  const seen = new Set();

  function visit(value) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    const card = value.listSingleCardContent || value;
    const id = card.location_id || card.locationId || card.id || card.saveId?.id || value.location_id || value.locationId || value.id;
    const rawName = card.name || card.title || card.cardTitle?.string || value.name || value.title;
    const name = (typeof rawName === "string" ? rawName : rawName?.string)?.replace(/^\s*\d+\.\s*/, "");
    // Provider versions have returned bare records, data.results, results.data,
    // and nested location objects. An ID + name identifies a place record even
    // when optional metadata (address, photo, rating) is omitted.
    if (id !== undefined && id !== null && name && typeof name === "string") {
      const key = String(id);
      if (!seen.has(key)) {
        seen.add(key);
        const location = card.location || card.coordinates || {};
        const imageUrl = firstImageUrl([
          card.photo?.images?.large,
          card.photo?.images?.original,
          card.photo?.images?.medium,
          card.cardPhoto,
          card.cardPhotos,
          card.photo,
          card.photos,
          card.image_url,
          card.imageUrl,
          card.image,
        ]);
        const originalImages = card.photo?.images && typeof card.photo.images === "object" ? card.photo.images : {};
        const largeUrl = firstImageUrl([originalImages.large, originalImages.original, imageUrl]);
        const smallUrl = firstImageUrl([originalImages.small, originalImages.thumbnail, imageUrl]);
        const photo = largeUrl ? {
          ...(card.photo && typeof card.photo === "object" ? card.photo : {}),
          images: {
            ...originalImages,
            large: { ...(originalImages.large || {}), url: largeUrl },
            small: { ...(originalImages.small || {}), url: smallUrl || largeUrl },
          },
        } : card.photo || null;
        const address = typeof card.address === "string"
          ? card.address
          : card.address_obj?.address_string || card.address_obj?.street1 ||
            card.address_obj?.address || location.address || "";
        const rating = card.rating ?? card.average_rating ?? card.bubbleRating?.rating ?? null;
        const reviewText = card.num_reviews ?? card.review_count ?? card.bubbleRating?.numberReviews?.string ?? "0";
        const infoText = card.primaryInfo?.text || "";
        const cuisineNames = infoText.split("•").map((part) => part.trim()).filter((part) => part && !isPriceNotation(part));
        const priceFields = normalizeRestaurantPrice(card, infoText);
        const routeUrl = card.cardLink?.route?.url || card.cardLink?.url || null;
        const webUrl = normalizeTripadvisorUrl(card.web_url ?? card.url ?? routeUrl);
        const booking = findExternalCommerceLink(card.commerceButtons);
        found.push({
          ...card,
          photo,
          imageUrl: largeUrl || null,
          location_id: String(id),
          name: String(name),
          address,
          latitude: finiteNumber(card.latitude ?? card.latitude_deg ?? card.lat ?? location.latitude ?? location.lat ?? card.address_obj?.latitude),
          longitude: finiteNumber(card.longitude ?? card.longitude_deg ?? card.lng ?? location.longitude ?? location.lng ?? card.address_obj?.longitude),
          rating,
          num_reviews: Number(String(reviewText).replace(/[^\d]/g, "")) || 0,
          web_url: webUrl,
          booking_url: booking?.url || null,
          booking_label: booking?.label || null,
          ...priceFields,
          cuisine: cuisineNames.map((cuisine) => ({ name: cuisine })),
        });
      }
    }

    Object.values(value).forEach(visit);
  }

  visit(payload);
  return found;
}

function firstImageUrl(sources) {
  const seen = new Set();
  const visit = (value, depth = 0) => {
    if (!value || depth > 5) return null;
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = visit(item, depth + 1);
        if (found) return found;
      }
      return null;
    }
    if (typeof value === "string") {
      let url = value.trim()
        .replace(/\{width\}/gi, "800").replace(/\{height\}/gi, "600")
        .replace(/\{w\}/gi, "800").replace(/\{h\}/gi, "600")
        .replace(/%7B(?:width|w)%7D/gi, "800").replace(/%7B(?:height|h)%7D/gi, "600");
      if (url.startsWith("//")) url = `https:${url}`;
      return /^https?:\/\//i.test(url) && !/[{}]/.test(url) ? url : null;
    }
    if (typeof value !== "object" || seen.has(value)) return null;
    seen.add(value);

    for (const key of ["urlTemplate", "url", "src", "imageUrl", "image_url", "href"]) {
      if (typeof value[key] === "string") {
        const found = visit(value[key], depth + 1);
        if (found) return found;
      }
    }
    for (const key of ["large", "original", "medium", "small", "thumbnail", "images", "sizes"]) {
      if (value[key]) {
        const found = visit(value[key], depth + 1);
        if (found) return found;
      }
    }
    return null;
  };
  for (const source of sources) {
    const found = visit(source);
    if (found) return found;
  }
  return null;
}

function textValue(value) {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (!value || typeof value !== "object") return "";
  for (const key of ["string", "text", "displayValue", "formatted", "value"]) {
    if (typeof value[key] === "string" || typeof value[key] === "number") return String(value[key]).trim();
  }
  return "";
}

function priceRangeText(value) {
  const direct = textValue(value);
  if (direct) return direct;
  if (!value || typeof value !== "object") return "";
  const min = value.min ?? value.minimum ?? value.minPrice ?? value.from;
  const max = value.max ?? value.maximum ?? value.maxPrice ?? value.to;
  if (min === undefined && max === undefined) return "";
  const currency = textValue(value.currency ?? value.currencyCode);
  const format = (amount) => amount === undefined ? "" : `${currency ? `${currency} ` : ""}${amount}`;
  return min !== undefined && max !== undefined ? `${format(min)} – ${format(max)}` : format(min ?? max);
}

function isPriceNotation(value) {
  return /^[\s$€£₹¥]+(?:[-–—][\s$€£₹]+)?\s*$/.test(String(value || ""));
}

function normalizeRestaurantPrice(card, primaryInfo) {
  const primaryPrice = String(primaryInfo || "").split("•")[0].trim();
  let priceRange = priceRangeText(card.price_range ?? card.priceRange ?? card.price?.range);
  let priceLevel = textValue(card.price_level ?? card.priceLevel ?? card.priceCategory);
  const apiPrice = card.price ?? card.priceInfo ?? card.commerceInfo?.priceForDisplay;
  let price = "";

  if (apiPrice && typeof apiPrice === "object" && (apiPrice.min !== undefined || apiPrice.max !== undefined)) {
    priceRange ||= priceRangeText(apiPrice);
  } else if (apiPrice !== undefined && apiPrice !== null && apiPrice !== "") {
    const amount = typeof apiPrice === "object"
      ? apiPrice.amount ?? apiPrice.value ?? apiPrice.displayValue ?? apiPrice.text ?? apiPrice.string
      : apiPrice;
    const currency = typeof apiPrice === "object"
      ? apiPrice.currency ?? apiPrice.currencyCode
      : card.currency ?? card.price_currency;
    const amountText = textValue(amount);
    if (amountText && !isPriceNotation(amountText)) {
      price = typeof amount === "string" && /[A-Za-z$€£₹¥]/.test(amount)
        ? amountText
        : `${currency ? `${textValue(currency)} ` : ""}${amountText}`;
    } else if (!priceLevel && amountText) {
      priceLevel = amountText;
    }
  }

  if (!priceRange && !priceLevel && isPriceNotation(primaryPrice)) {
    if (/[-–—]/.test(primaryPrice)) priceRange = primaryPrice;
    else priceLevel = primaryPrice;
  }
  if (priceLevel && /[-–—]/.test(priceLevel) && !priceRange) {
    priceRange = priceLevel;
    priceLevel = "";
  }

  return {
    price: price || null,
    price_range: priceRange || null,
    price_level: priceLevel || null,
  };
}

function normalizeTripadvisorUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const url = value.trim();
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/") && !url.startsWith("//")) return `https://www.tripadvisor.com${url}`;
  return null;
}

function findExternalCommerceLink(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return null;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findExternalCommerceLink(item, seen);
      if (match) return match;
    }
    return null;
  }
  if (typeof value.externalUrl === "string" && /^https?:\/\//i.test(value.externalUrl)) {
    return {
      url: value.externalUrl,
      label: textValue(value.text ?? value.accessibilityString) || null,
    };
  }
  for (const child of Object.values(value)) {
    const match = findExternalCommerceLink(child, seen);
    if (match) return match;
  }
  return null;
}

function finiteNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function responseShape(payload, depth = 0) {
  if (Array.isArray(payload)) return payload.length ? { type: "array", length: payload.length, item: responseShape(payload[0], depth + 1) } : "array(0)";
  if (!payload || typeof payload !== "object") return typeof payload;
  if (depth >= 5) return `object(${Object.keys(payload).slice(0, 20).join(",")})`;
  return Object.fromEntries(Object.entries(payload).slice(0, 30).map(([key, value]) => [key, responseShape(value, depth + 1)]));
}

app.post("/api/places", async (req, res) => {
  try {
    const { geoId, boundingBox, type = "restaurants" } = req.body || {};

    if (type !== "restaurants") {
      return res.status(400).json({
        error: "This API integration currently supports restaurants only.",
      });
    }

    if (!geoId || !boundingBox?.northEastCorner || !boundingBox?.southWestCorner) {
      return res.status(400).json({
        error: "geoId and a valid boundingBox are required.",
      });
    }

    if (!process.env.RAPIDAPI_KEY) {
      return res.status(500).json({
        error: "RAPIDAPI_KEY is missing from server/.env",
      });
    }

    const north = Number(boundingBox.northEastCorner.latitude);
    const east = Number(boundingBox.northEastCorner.longitude);
    const south = Number(boundingBox.southWestCorner.latitude);
    const west = Number(boundingBox.southWestCorner.longitude);
    if (![north, east, south, west].every(Number.isFinite) || north < south) {
      return res.status(400).json({ error: "boundingBox coordinates must be finite and northEastCorner must be north of southWestCorner." });
    }

    const response = await axios.post(
      `https://${RAPIDAPI_HOST}/restaurants/v2/list`,
      {
        geoId: Number(geoId),
        partySize: 2,
        sort: "POPULARITY",
        sortOrder: "desc",
        filters: [],
        boundingBox,
        updateToken: "",
      },
      {
        params: { currency: "USD", units: "km", lang: "en_US" },
        headers: {
          "x-rapidapi-key": process.env.RAPIDAPI_KEY,
          "x-rapidapi-host": RAPIDAPI_HOST,
          "Content-Type": "application/json",
        },
        timeout: 25000,
      }
    );
    const places = extractPlaces(response.data);
    console.log(`Tripadvisor responded HTTP ${response.status}; normalized ${places.length} places. Response shape: ${JSON.stringify(responseShape(response.data))}`);
    return res.json({ places });
  } catch (error) {
    const upstreamStatus = error.response?.status;
    const providerDetails = error.response?.data || error.message;
    console.error("Tripadvisor request failed:", upstreamStatus || "network/timeout", providerDetails);
    return res.status(upstreamStatus && upstreamStatus >= 400 && upstreamStatus < 500 ? upstreamStatus : 502).json({
      error: "Unable to fetch restaurants from Tripadvisor.",
      details: providerDetails,
    });
  }
});


app.get("/api/weather", async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ error: "lat and lng are required." });
    }
    if (!process.env.OPENWEATHER_API_KEY) {
      return res.status(503).json({ error: "Weather is not configured; places search can still work." });
    }

    const response = await axios.get("https://api.openweathermap.org/data/2.5/weather", {
      params: {
        lat: Number(lat),
        lon: Number(lng),
        appid: process.env.OPENWEATHER_API_KEY,
        units: "metric",
      },
      timeout: 15000,
    });
    return res.json(response.data);
  } catch (error) {
    console.error("Weather API error:", error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      error: "Unable to fetch weather.",
      details: error.response?.data || error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Travel Advisor API listening on port ${PORT}`);
});
