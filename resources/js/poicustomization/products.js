import {
  PRODUCT_SOURCE_ID,
  PRODUCT_POINT_LAYER_ID
} from './constants.js';
import { parseLineStringToCoords, midpointOfLine, boundsFromFeatureCollection } from './utils.js';
import { saveViewport } from './map-init.js';
import { clearProductLinesInDraw, pushProductLineIds, rebuildOwnershipMap, setLinePositionData } from './draw.js';
import { apiFetch } from './auth.js';

const productsById = new Map();

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
        position: idx + 1
      }
    });
  });

  return { type: 'FeatureCollection', features };
}

