import { VIEWPORT_KEY } from './constants.js';

export function setInitialViewportFromStorage() {
  try {
    const raw = localStorage.getItem(VIEWPORT_KEY);

    let initCenter = [
      -88.5678,
      20.6829
    ];
    let initZoom = 12;

    if (raw) {
      const data = JSON.parse(raw);
      const lng = Number(data && data.lng);
      const lat = Number(data && data.lat);
      const zoom = Number(data && data.zoom);

      const lngOk = Number.isFinite(lng) && lng >= -180 && lng <= 180;
      const latOk = Number.isFinite(lat) && lat >= -90 && lat <= 90;
      const zoomOk = Number.isFinite(zoom) && zoom >= 1 && zoom <= 22;

      if (lngOk && latOk) {
        initCenter = [
          lng,
          lat
        ];
      }

      if (zoomOk) {
        initZoom = zoom;
      }
    }

    // Return resolved initial center/zoom
    return { initCenter, initZoom };
  } catch (_) {
    return {
      initCenter: [
        -88.5678,
        20.6829
      ],
      initZoom: 12
    };
  }
}

export function saveViewport(map) {
  try {
    const center = map.getCenter();
    const zoom = map.getZoom();

    const payload = {
      lng: Number(center.lng),
      lat: Number(center.lat),
      zoom: Number(zoom)
    };

    localStorage.setItem(
      VIEWPORT_KEY,
      JSON.stringify(payload)
    );
  } catch (_) {
    // ignore
  }
}

export function getSavedViewport() {
  try {
    const raw = localStorage.getItem(VIEWPORT_KEY);

    if (!raw) {
      return null;
    }

    const data = JSON.parse(raw);

    const lng = Number(data.lng);
    const lat = Number(data.lat);
    const zoom = Number(data.zoom);

    if (!(Number.isFinite(lng) && Number.isFinite(lat) && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90)) {
      return null;
    }

    if (!Number.isFinite(zoom) || zoom < 1 || zoom > 22) {
      return null;
    }

    return {
      lng,
      lat,
      zoom
    };
  } catch (_) {
    return null;
  }
}
