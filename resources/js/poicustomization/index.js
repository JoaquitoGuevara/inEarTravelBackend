/* global mapboxgl, MapboxDraw */

import { LINE_COLOR, LINE_POS_CIRCLE_LAYER_ID } from './constants.js';
import { setInitialViewportFromStorage, getSavedViewport, saveViewport } from './map-init.js';
import { createDraw, ensureLinePositionLayer, getDrawInstance } from './draw.js';
import { getAuthToken, setAuthToken, apiFetch, ensureAuthPermission, attachLogoutHandler, showLoginModal } from './auth.js';
import { loadProducts, renderProductFactory, refreshLinePositionOverlay, productsById, openLinkModal, saveLineToMarker } from './products.js';
import { isValidLngLat } from './utils.js';

// Mapbox access token: keep same as original file
mapboxgl.accessToken = 'pk.eyJ1Ijoid2VibWFzdGVyZGV2IiwiYSI6ImNtY3YwZmhqcjA1ZzcyaW9iZWdqYWVhbmsifQ.f9xXELkr-1TQIzvH0XPi9g';

document.addEventListener('DOMContentLoaded', () => {
  const vp = setInitialViewportFromStorage();

  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: vp.initCenter,
    zoom: vp.initZoom
  });

  map.addControl(
    new mapboxgl.NavigationControl(),
    'top-right'
  );

  const draw = createDraw(map);

  const outputEl = document.getElementById('output');

  function updateOutput() {
    const data = draw.getAll();

    const features = (data && data.features) ? data.features : [];

    const filtered = features.filter((f) => {
      const hasMarker = (
        f &&
        f.properties &&
        typeof f.properties.markerId !== 'undefined' &&
        f.properties.markerId !== null
      );

      return !hasMarker;
    });

    const out = {
      type: 'FeatureCollection',
      features: filtered
    };

    outputEl.value = JSON.stringify(
      out,
      null,
      2
    );
  }

  map.on('load', async () => {
    updateOutput();

    // initialize product layers (small inline version to avoid extra file)
    if (!map.getSource('product-data')) {
      map.addSource('product-data', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    }

    if (!map.getLayer('product-points')) {
      map.addLayer({
        id: 'product-points',
        type: 'circle',
        source: 'product-data',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 6,
          'circle-color': '#ef4444',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });

      map.on('click', 'product-points', (e) => {
        const f = e.features && e.features[0];
        if (!f) return;

        const coords = f.geometry.coordinates.slice();
        const title = (f.properties && f.properties.title) ? f.properties.title : 'Marker';
        const desc = (f.properties && f.properties.description) ? f.properties.description : '';

        new mapboxgl.Popup().setLngLat(coords).setHTML(`<strong>${title}</strong><br/>${desc}`).addTo(map);
      });

      map.on('mouseenter', 'product-points', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'product-points', () => { map.getCanvas().style.cursor = ''; });
    }

    ensureLinePositionLayer(map, LINE_COLOR);

    attachLogoutHandler(setAuthToken);

    const ok = await ensureAuthPermission(showLoginModal);

    if (ok) {
      const hasVp = !!getSavedViewport();
      await loadProducts(map, renderProductFactory(map, draw), { keepViewport: hasVp });
    }
  });

  // Save viewport on interactions
  map.on('moveend', () => {
    saveViewport(map);
  });

  // Draw event handlers (create/delete/update)
  map.on('draw.create', () => {
    updateOutput();

    const tempData = draw.getAll();
    const tempLinesFc = {
      type: 'FeatureCollection',
      features: (tempData.features || []).filter((f) => {
        return (
          f && f.geometry && f.geometry.type === 'LineString' && !(f.properties && typeof f.properties.markerId !== 'undefined' && f.properties.markerId !== null)
        );
      })
    };

    // Refresh overlay circles for the currently selected product so newly-drawn lines show empty circles
    const selectEl = document.getElementById('product-select');
    const current = selectEl && productsById.get(String(selectEl.value));
    if (current) {
      try { refreshLinePositionOverlay(map, current, draw); } catch (_) {}
    }
  });

  map.on('draw.delete', async (e) => {
    updateOutput();

    const deleted = (e && e.features) ? e.features : [];
    const toClear = deleted.filter((f) => {
      return (
        f && f.geometry && f.geometry.type === 'LineString' && f.properties && (typeof f.properties.markerId !== 'undefined' && f.properties.markerId !== null)
      );
    });

    if (toClear.length === 0) {
      // nothing to clear
      return;
    }

    try {
      for (const f of toClear) {
        const markerId = f.properties.markerId;

        await apiFetch(`/api/mapmarkers/${markerId}/lineString`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ lineString: null }) });
      }

      const res = await fetch('/api/products?t=' + Date.now(), { cache: 'no-store' });
      const json = await res.json();

      const selectEl = document.getElementById('product-select');
      const currentId = selectEl && selectEl.value;

      const updated = (json.products || []).find((p) => String(p.id) === String(currentId));
      if (updated) {
        // rely on loadProducts to re-render selected product
        await loadProducts(map, renderProductFactory(map, draw), { keepViewport: true });
      }
    } catch (err) {
      alert('Failed to update deleted line(s): ' + err.message);
    }
  });

  map.on('draw.update', async (e) => {
    updateOutput();

    const changed = (e && e.features) ? e.features : [];
    const toSave = changed.filter((f) => {
      return (
        f && f.geometry && f.geometry.type === 'LineString' && f.properties && (typeof f.properties.markerId !== 'undefined' && f.properties.markerId !== null)
      );
    });

    if (toSave.length === 0) {
      return;
    }

    try {
      for (const f of toSave) {
        const markerId = f.properties.markerId;
        const coords = f.geometry.coordinates;

        await apiFetch(`/api/mapmarkers/${markerId}/lineString`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ lineString: coords }) });
      }

      await loadProducts(map, renderProductFactory(map, draw), { keepViewport: true });
    } catch (err) {
      alert('Failed to save updated line(s): ' + err.message);
    }
  });

  // Click handler for the line position circles: open link modal and save selection
  map.on('click', LINE_POS_CIRCLE_LAYER_ID, async (e) => {
    const feat = e.features && e.features[0];
    if (!feat) return;
    const props = feat.properties || {};

    const selectEl = document.getElementById('product-select');
    const current = selectEl && productsById.get(String(selectEl.value));
    if (!current) return;

    const selection = await openLinkModal(current.id, props);
    if (!selection || !selection.markerId) return;

    // Find the line geometry: prefer temp draw feature if present
    let lineFeature = null;
    if (props.tempDrawId) {
      const all = draw.getAll();
      lineFeature = (all.features || []).find(f => String(f.id) === String(props.tempDrawId));
    }

    if (!lineFeature && props.markerId) {
      const mm = current.mapmarkers.find(m => String(m.id) === String(props.markerId));
      if (mm && mm.lineString) {
        let parsed = null;
        try { parsed = JSON.parse(mm.lineString); } catch (_) { parsed = mm.lineString; }
        if (Array.isArray(parsed)) {
          lineFeature = { geometry: { type: 'LineString', coordinates: parsed } };
        } else if (parsed && parsed.type === 'LineString') {
          lineFeature = { geometry: parsed };
        }
      }
    }

    if (!lineFeature) return;

    await saveLineToMarker(current, map, draw, lineFeature, selection.markerId);
  });

  // wire simple UI buttons
  document.getElementById('copy-btn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(outputEl.value);

      const btn = document.getElementById('copy-btn');
      const prev = btn.textContent;

      btn.textContent = 'Copied!';

      setTimeout(() => { btn.textContent = prev; }, 1000);
    } catch (_) {
      alert('Copy failed. You can manually select and copy the text.');
    }
  });

  document.getElementById('clear-btn').addEventListener('click', () => {
    draw.deleteAll();
    updateOutput();
  });

  document.getElementById('fit-btn').addEventListener('click', () => {
    // fit uses draw.getAll and map.fitBounds; keep simple here
    const data = draw.getAll();
    if (!data || !data.features || data.features.length === 0) {
      return;
    }

    const bounds = new mapboxgl.LngLatBounds();

    data.features.forEach((f) => {
      const geom = f.geometry;
      if (!geom) return;

      const addCoord = (c) => bounds.extend(c);

      switch (geom.type) {
        case 'Point': addCoord(geom.coordinates); break;
        case 'LineString': geom.coordinates.forEach(addCoord); break;
        case 'Polygon': geom.coordinates.forEach((r) => r.forEach(addCoord)); break;
        case 'MultiLineString': geom.coordinates.forEach((line) => line.forEach(addCoord)); break;
        case 'MultiPolygon': geom.coordinates.forEach((poly) => poly.forEach((r) => r.forEach(addCoord))); break;
      }
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 30, maxZoom: 16, duration: 600 });
    }
  });

  document.getElementById('product-select').addEventListener('change', (e) => {
    const id = e.target.value;

    localStorage.setItem('poicustomization.selectedProductId', id);

    // re-render selected product
    loadProducts(map, renderProductFactory(map, draw), { keepViewport: true });
  });

});
