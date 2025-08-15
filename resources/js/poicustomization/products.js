import {
  PRODUCT_SOURCE_ID,
  PRODUCT_POINT_LAYER_ID
} from './constants.js';
import { parseLineStringToCoords, midpointOfLine, boundsFromFeatureCollection } from './utils.js';
import { saveViewport } from './map-init.js';
import { clearProductLinesInDraw, pushProductLineIds, rebuildOwnershipMap, setLinePositionData } from './draw.js';
import { apiFetch } from './auth.js';

export const productsById = new Map();
// Track created Mapbox Marker instances so we can remove them when re-rendering
const renderedPointMarkers = new Map(); // key: markerId -> mapboxgl.Marker

export function pointsFcFromMarkers(markers) {
  const features = [];

  (markers || []).forEach((m) => {
    const lng = Number(m.longitude);
    const lat = Number(m.latitude);

    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [
            lng,
            lat
          ]
        },
        properties: {
          title: m.title || '',
          description: m.description || '',
          position: Number.isFinite(Number(m.position)) ? Number(m.position) : null
        }
      });
    }
  });

  return {
    type: 'FeatureCollection',
    features
  };
}

// Create draggable mapbox markers from map marker records and wire persistence on dragend
export function renderDraggablePoints(map, draw, product) {
  // remove any previously rendered markers
  for (const [k, existing] of renderedPointMarkers.entries()) {
    try { existing.remove(); } catch (_) {}
    renderedPointMarkers.delete(k);
  }

  (product.mapmarkers || []).forEach((m) => {
    const lng = Number(m.longitude);
    const lat = Number(m.latitude);

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;

  const el = document.createElement('div');
  el.className = 'poi-marker';
  // Keep DOM marker minimal; visual rendering comes from map layers to avoid drift
  el.style.width = '18px';
  el.style.height = '18px';
  el.style.borderRadius = '50%';
  el.style.position = 'relative';
  el.style.display = 'block';
  // Make it transparent by default (we show map layers for visuals)
  el.style.background = 'transparent';
  el.style.border = '0';
    el.title = m.title || '';

  // No DOM label; text is rendered via map symbol layer

    const marker = new mapboxgl.Marker({ element: el, draggable: true, anchor: 'center' })
      .setLngLat([lng, lat])
      .addTo(map);

    // During drag, hide the map layers to reduce visual duplication, then restore
    marker.on('dragstart', () => {
      try {
        if (map.getLayer('product-points')) map.setLayoutProperty('product-points', 'visibility', 'none');
        if (map.getLayer('product-points-text')) map.setLayoutProperty('product-points-text', 'visibility', 'none');
      } catch (_) {}
    });

  // Persist on drag end
  marker.on('dragend', async () => {
      try {
        const ll = marker.getLngLat();
        await apiFetch(`/api/mapmarkers/${m.id}/position`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ latitude: ll.lat, longitude: ll.lng }) });

  // Refresh product data and overlay positions
        const res = await fetch('/api/products?t=' + Date.now(), { cache: 'no-store' });
        const json = await res.json();

        const updated = (json.products || []).find((p) => String(p.id) === String(product.id));
        if (updated) {
          productsById.set(String(product.id), updated);
          // re-render points layer and draggable markers
          const src = map.getSource(PRODUCT_SOURCE_ID);
          if (src) src.setData(pointsFcFromMarkers(updated.mapmarkers || []));
          // also refresh line positions overlay
          const tempData = (draw && typeof draw.getAll === 'function') ? draw.getAll() : { type: 'FeatureCollection', features: [] };
          const tempLinesFc = { type: 'FeatureCollection', features: (tempData.features || []).filter((f) => f && f.geometry && f.geometry.type === 'LineString' && !(f.properties && typeof f.properties.markerId !== 'undefined' && f.properties.markerId !== null)) };
          const posFc = buildLinePositionFeatures(updated, tempLinesFc);
          setLinePositionData(map, posFc);
          // remove and recreate draggable markers for fresh positions
          renderDraggablePoints(map, draw, updated);
        }
      } catch (err) {
        alert('Failed to save marker position: ' + (err && err.message ? err.message : err));
      } finally {
        // Restore layers after drag completes
        try {
          if (map.getLayer('product-points')) map.setLayoutProperty('product-points', 'visibility', 'visible');
          if (map.getLayer('product-points-text')) map.setLayoutProperty('product-points-text', 'visibility', 'visible');
        } catch (_) {}
      }
    });

    renderedPointMarkers.set(String(m.id), marker);
  });
}

// Opens the existing link modal for a product and a line feature props.
// Keeps this small: returns a promise that resolves when the user confirms a marker selection.
export function openLinkModal(productId, lineProps) {
  // The original app used a global UI function to open the modal. We'll try to reuse it if present.
  // If the app has a function `openLinkModalForLine(productId, lineProps, resolve)` we call it.
  return new Promise((resolve, reject) => {
    if (typeof window.openLinkModalForLine === 'function') {
      try {
        window.openLinkModalForLine(productId, lineProps, resolve);
      } catch (err) {
        reject(err);
      }
    } else {
      // No fallback prompt: if the page doesn't provide the modal hook, resolve null so caller can no-op.
      console.error('openLinkModalForLine not available on window; cannot open link dialog');
      resolve(null);
    }
  });
}

// Save line geometry to a marker by calling the server endpoint and refresh product.
export async function saveLineToMarker(product, map, mapboxDraw, lineFeature, markerId) {
  if (!markerId) return null;
  const url = `/api/mapmarkers/${markerId}/lineString`;
  // Normalize to coordinates array, matching usage in draw.update handler
  let coords = null;
  if (lineFeature && lineFeature.geometry) {
    if (lineFeature.geometry.type === 'LineString' && Array.isArray(lineFeature.geometry.coordinates)) {
      coords = lineFeature.geometry.coordinates;
    } else if (Array.isArray(lineFeature.geometry)) {
      coords = lineFeature.geometry;
    }
  } else if (Array.isArray(lineFeature)) {
    coords = lineFeature;
  }

  const body = { lineString: coords };
  await apiFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) });
  // After saving, reload products to refresh overlay/markers
  await loadProducts(map, renderProductFactory(map, mapboxDraw), { keepViewport: true });
}

// Clear an existing marker's line
export async function clearMarkerLine(markerId) {
  if (!markerId) return;
  await apiFetch(`/api/mapmarkers/${markerId}/lineString`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ lineString: null })
  });
}

export function linesFcFromMarkers(markers) {
  const features = [];

  (markers || []).forEach((m) => {
    if (!m.lineString) {
      return;
    }

    const coords = parseLineStringToCoords(m.lineString);

    if (coords.length >= 2) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coords
        },
        properties: {
          // keep metadata so edits can be saved back to DB
          markerId: m.id,
          position: Number.isFinite(Number(m.position)) ? Number(m.position) : null,
          title: m.title || '',
          description: m.description || ''
        }
      });
    }
  });

  return {
    type: 'FeatureCollection',
    features
  };
}

export async function loadProducts(map, renderProduct, options = {}) {
  const selectEl = document.getElementById('product-select');

  try {
    const res = await fetch('/api/products?t=' + Date.now(), { cache: 'no-store' });
    const json = await res.json();

    const products = (json && (json.products || json.audios || [])) || [];

    selectEl.innerHTML = '';

    products.forEach((p) => {
      productsById.set(
        String(p.id),
        p
      );

      const opt = document.createElement('option');
      opt.value = String(p.id);
      opt.textContent = p.name || `Product ${p.id}`;
      selectEl.appendChild(opt);
    });

    const storedId = localStorage.getItem('poicustomization.selectedProductId');

    let selected = null;

    if (storedId) {
      selected = products.find((p) => String(p.id) === storedId) || null;
    }

    if (!selected && products.length > 0) {
      selected = products[0];
    }

    if (selected) {
      selectEl.value = String(selected.id);
      renderProduct(
        selected,
        { keepViewport: options && options.keepViewport === true }
      );
    } else {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No products found';
      opt.disabled = true;
      opt.selected = true;
      selectEl.appendChild(opt);
    }
  } catch (_) {
    selectEl.innerHTML = '';

    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Failed to load products';
    opt.disabled = true;
    opt.selected = true;
    selectEl.appendChild(opt);
  }
}

export function renderProductFactory(map, draw) {
  // returns a renderProduct(product, options) bound to map/draw
  return function renderProduct(product, options = {}) {
    if (!product) {
      return;
    }

    const keepViewport = options && options.keepViewport === true;

    const markers = product.mapmarkers || product.mapMarkers || [];

    const existingLinesFc = linesFcFromMarkers(markers);
    const pointsFc = pointsFcFromMarkers(markers);

    clearProductLinesInDraw();

    // Add existing lines to draw and track ids
    if (existingLinesFc.features.length > 0) {
      const added = draw.add(existingLinesFc);
      const ids = Array.isArray(added) ? added : [added];

      pushProductLineIds(ids);

      // Rebuild ownership map: draw feature id -> markerId
      rebuildOwnershipMap();
    }

    const src = map.getSource(PRODUCT_SOURCE_ID);

    if (src) {
      src.setData(pointsFc);
  // also render draggable point markers for customization
  try { renderDraggablePoints(map, draw, product); } catch (_) {}
    }

    const tempData = draw.getAll();
    const tempLinesFc = {
      type: 'FeatureCollection',
      features: (tempData.features || []).filter((f) => {
        return (
          f &&
          f.geometry &&
          f.geometry.type === 'LineString' &&
          !(f.properties && typeof f.properties.markerId !== 'undefined' && f.properties.markerId !== null)
        );
      })
    };

    // build overlay positions from markers + temp lines
    const posFc = buildLinePositionFeatures(product, tempLinesFc);
    setLinePositionData(map, posFc);

    if (keepViewport) {
      return;
    }

    const lng = Number(product.defaultLongitude);
    const lat = Number(product.defaultLatitude);

    const hasCenter = Number.isFinite(lng) && Number.isFinite(lat) && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
    const zoomConfigured = parseInt(product.zoom, 10);

    const lngDelta = Number(product.defaultLongitudeDelta);
    const latDelta = Number(product.defaultLatitudeDelta);

    const hasDeltas = (
      Number.isFinite(lngDelta) &&
      Number.isFinite(latDelta) &&
      lngDelta > 0 &&
      latDelta > 0
    );

    if (hasCenter && hasDeltas) {
      const sw = [
        lng - lngDelta / 2,
        lat - latDelta / 2
      ];

      const ne = [
        lng + lngDelta / 2,
        lat + latDelta / 2
      ];

      const b = new mapboxgl.LngLatBounds(sw, ne);

      map.fitBounds(
        b,
        {
          padding: 30,
          maxZoom: 18,
          duration: 600
        }
      );

      map.once('moveend', () => {
        try { saveViewport(map); } catch (_) {}
      });
    } else if (hasCenter && Number.isFinite(zoomConfigured)) {
      map.flyTo({
        center: [
          lng,
          lat
        ],
        zoom: zoomConfigured,
        essential: true
      });

      map.once('moveend', () => {
        try { saveViewport(map); } catch (_) {}
      });
    } else {
      const allFc = {
        type: 'FeatureCollection',
        features: [
          ...existingLinesFc.features,
          ...pointsFc.features
        ]
      };

      const b = boundsFromFeatureCollection(allFc);

      if (!b.isEmpty()) {
        map.fitBounds(
          b,
          {
            padding: 30,
            maxZoom: 17,
            duration: 600
          }
        );

        map.once('moveend', () => {
          try { saveViewport(map); } catch (_) {}
        });
      } else if (hasCenter) {
        map.flyTo({
          center: [
            lng,
            lat
          ],
          zoom: 15,
          essential: true
        });

        map.once('moveend', () => {
          try { saveViewport(map); } catch (_) {}
        });
      }
    }
  };
}

function buildLinePositionFeatures(product, tempLinesFc) {
  const features = [];
  const markers = product.mapmarkers || product.mapMarkers || [];

  markers.forEach((m) => {
    if (!m.lineString) {
      return;
    }

    const coords = parseLineStringToCoords(m.lineString);

    if (coords.length >= 2) {
      const mid = midpointOfLine(coords);

      if (mid) {
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: mid },
          properties: {
            linked: true,
            position: Number.isFinite(Number(m.position)) ? Number(m.position) : null,
            markerId: m.id,
            title: m.title || ''
          }
        });
      }
    }
  });

  // Only add temp overlay points for UNLINKED lines
  (tempLinesFc.features || []).forEach((f, idx) => {
    if (!f || !f.geometry || f.geometry.type !== 'LineString') {
      return;
    }

    if (f.properties && typeof f.properties.markerId !== 'undefined' && f.properties.markerId !== null) {
      return; // skip linked lines to avoid duplicate circles
    }

    const mid = midpointOfLine(f.geometry.coordinates);
    if (!mid) {
      return;
    }

  features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: mid },
      properties: {
        linked: false,
        tempDrawId: f.id || null,
        tempIndex: idx,
    // no position for unlinked temp overlays (show empty circle)
      }
    });
  });

  return { type: 'FeatureCollection', features };
}

// Refresh the line position overlay (circles) for a product using current draw temp lines
export function refreshLinePositionOverlay(map, product, draw) {
  try {
    // Ensure layer exists
    // draw.js exposes ensureLinePositionLayer via index.js flow, so just build data
    const tempData = (draw && typeof draw.getAll === 'function') ? draw.getAll() : { type: 'FeatureCollection', features: [] };
    const tempLinesFc = {
      type: 'FeatureCollection',
      features: (tempData.features || []).filter((f) => {
        return f && f.geometry && f.geometry.type === 'LineString' && !(f.properties && typeof f.properties.markerId !== 'undefined' && f.properties.markerId !== null);
      })
    };

    const fc = buildLinePositionFeatures(product, tempLinesFc);
    setLinePositionData(map, fc);
  } catch (_) {
    // ignore
  }
}

