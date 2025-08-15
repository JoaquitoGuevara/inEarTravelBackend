/* global mapboxgl, MapboxDraw */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const AUTH_TOKEN_KEY = 'poicustomization.token';

  function getAuthToken() {
    const t = localStorage.getItem(AUTH_TOKEN_KEY);
    return t ? t : null;
  }

  function setAuthToken(token) {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  }

  async function apiFetch(url, options = {}) {
    const headers = options.headers ? { ...options.headers } : {};
    const token = getAuthToken();

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return fetch(url, {
      ...options,
      headers
    });
  }

  async function ensureAuthPermission() {
    try {
      const res = await apiFetch(
        '/api/userdata',
        {
          credentials: 'same-origin'
        }
      );

      if (!res.ok) {
        // Not logged in
        showLoginModal();
        return false;
      }

      const data = await res.json();
      const user = data && data.user ? data.user : data;

      if (!user || user.hasPoiCustomizationPermission !== true) {
        // Logged in but no permission
        showLoginModal('You do not have POI customization permission.');
        return false;
      }

      return true;
    } catch (_) {
      showLoginModal();
      return false;
    }
  }

  function showLoginModal(message) {
    const overlay = document.getElementById('login-modal');
    const err = document.getElementById('login-error');
    const emailEl = document.getElementById('login-email');
    const passEl = document.getElementById('login-password');

    err.style.display = message ? 'block' : 'none';
    err.textContent = message || '';

    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');

    const onCancel = () => {
      cleanup();
    };

    const onKey = (e) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    const onSubmit = async () => {
      err.style.display = 'none';
      err.textContent = '';

      const email = emailEl.value.trim();
      const password = passEl.value;

      if (!email || !password) {
        err.textContent = 'Email and password are required.';
        err.style.display = 'block';
        return;
      }

      try {
        const res = await fetch(
          '/api/login',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
          }
        );

        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || 'Login failed');
        }

        const data = await res.json();
        const token = (data && (data.token || data.access_token || data.plainTextToken)) || null;
        const user = data && data.user ? data.user : null;

        if (user && user.hasPoiCustomizationPermission !== true) {
          throw new Error('You do not have POI customization permission.');
        }

        if (token) {
          setAuthToken(token);
        }

        cleanup();
        window.location.reload();
      } catch (e) {
        err.textContent = e.message || 'Login failed';
        err.style.display = 'block';
      }
    };

    const cleanup = () => {
      overlay.style.display = 'none';
      overlay.setAttribute('aria-hidden', 'true');

      document
        .getElementById('login-cancel')
        .removeEventListener('click', onCancel);

      document
        .getElementById('login-submit')
        .removeEventListener('click', onSubmit);

      document
        .removeEventListener('keydown', onKey);
    };

    document
      .getElementById('login-cancel')
      .addEventListener('click', onCancel);

    document
      .getElementById('login-submit')
      .addEventListener('click', onSubmit);

    document
      .addEventListener('keydown', onKey);
  }

  function attachLogoutHandler() {
    const btn = document.getElementById('logout-btn');
    if (!btn) {
      return;
    }

    btn.addEventListener('click', async () => {
      try {
        await apiFetch(
          '/api/logout',
          { method: 'POST' }
        );
      } catch (_) {
        // ignore
      }

      setAuthToken(null);
      window.location.reload();
    });
  }

  // Initialize Mapbox
  mapboxgl.accessToken = 'pk.eyJ1Ijoid2VibWFzdGVyZGV2IiwiYSI6ImNtY3YwZmhqcjA1ZzcyaW9iZWdqYWVhbmsifQ.f9xXELkr-1TQIzvH0XPi9g';

  // Use last-session viewport as initial map view if available
  (function setInitialViewportFromStorage() {
    try {
      const raw = localStorage.getItem('poicustomization.viewport');

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

      // Create map with resolved initial center/zoom
      window.__poicustomization_initialCenter = initCenter;
      window.__poicustomization_initialZoom = initZoom;
    } catch (_) {
      window.__poicustomization_initialCenter = [
        -88.5678,
        20.6829
      ];
      window.__poicustomization_initialZoom = 12;
    }
  })();

  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: window.__poicustomization_initialCenter,
    zoom: window.__poicustomization_initialZoom
  });

  // Single color used for both lines (Mapbox Draw default) and our position circles
  const LINE_COLOR = '#3bb2d0';

  // Persisted viewport storage key
  const VIEWPORT_KEY = 'poicustomization.viewport';

  function saveViewport() {
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

  function getSavedViewport() {
    try {
      const raw = localStorage.getItem(VIEWPORT_KEY);

      if (!raw) {
        return null;
      }

      const data = JSON.parse(raw);

      const lng = Number(data.lng);
      const lat = Number(data.lat);
      const zoom = Number(data.zoom);

      if (!isValidLngLat(lng, lat)) {
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

  function restoreViewportIfSaved() {
    const vp = getSavedViewport();

    if (!vp) {
      return;
    }

    map.flyTo({
      center: [
        vp.lng,
        vp.lat
      ],
      zoom: vp.zoom,
      essential: true
    });
  }

  map.addControl(
    new mapboxgl.NavigationControl(),
    'top-right'
  );

  const draw = new MapboxDraw({
    displayControlsDefault: false,
    controls: {
      polygon: true,
      line_string: true,
      trash: true,
      combine_features: true,
      uncombine_features: true
    },
    defaultMode: 'simple_select'
  });

  map.addControl(
    draw,
    'top-left'
  );

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

  function fitToDrawings() {
    const data = draw.getAll();
    if (!data || !data.features || data.features.length === 0) {
      return;
    }

    const bounds = new mapboxgl.LngLatBounds();

    data.features.forEach((f) => {
      const geom = f.geometry;
      if (!geom) {
        return;
      }

      const addCoord = (c) => bounds.extend(c);

      switch (geom.type) {
        case 'Point':
          addCoord(geom.coordinates);
          break;
        case 'LineString':
          geom.coordinates.forEach(addCoord);
          break;
        case 'Polygon':
          geom.coordinates.forEach((r) => r.forEach(addCoord));
          break;
        case 'MultiLineString':
          geom.coordinates.forEach((line) => line.forEach(addCoord));
          break;
        case 'MultiPolygon':
          geom.coordinates.forEach((poly) => poly.forEach((r) => r.forEach(addCoord)));
          break;
      }
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(
        bounds,
        {
          padding: 30,
          maxZoom: 16,
          duration: 600
        }
      );

      map.once('moveend', () => {
        saveViewport();
      });
    }
  }

  // IDs and state
  const PRODUCT_SOURCE_ID = 'product-data';
  const PRODUCT_POINT_LAYER_ID = 'product-points';
  const LINE_POS_SOURCE_ID = 'line-positions';
  const LINE_POS_CIRCLE_LAYER_ID = 'line-positions-circle';
  const LINE_POS_TEXT_LAYER_ID = 'line-positions-text';

  const productsById = new Map();
  let productLineDrawIds = [];
  const drawIdToMarkerId = new Map();

  function isValidLngLat(lng, lat) {
    return (
      Number.isFinite(lng) &&
      Number.isFinite(lat) &&
      lng >= -180 &&
      lng <= 180 &&
      lat >= -90 &&
      lat <= 90
    );
  }

  function parseZoom(z) {
    const n = Number(z);

    if (!Number.isFinite(n)) {
      return null;
    }
    if (n < 1 || n > 22) {
      return null;
    }

    return n;
  }

  function boundsFromFeatureCollection(fc) {
    const b = new mapboxgl.LngLatBounds();

    if (!fc || !fc.features) {
      return b;
    }

    const add = (c) => {
      const [lng, lat] = c;
      if (isValidLngLat(lng, lat)) {
        b.extend([lng, lat]);
      }
    };

    fc.features.forEach((f) => {
      const g = f.geometry;
      if (!g) {
        return;
      }

      const t = g.type;

      if (t === 'Point') {
        add(g.coordinates);
      } else if (t === 'LineString') {
        g.coordinates.forEach(add);
      } else if (t === 'Polygon') {
        g.coordinates.forEach((r) => r.forEach(add));
      } else if (t === 'MultiLineString') {
        g.coordinates.forEach((line) => line.forEach(add));
      } else if (t === 'MultiPolygon') {
        g.coordinates.forEach((poly) => poly.forEach((r) => r.forEach(add)));
      }
    });

    return b;
  }

  function initProductLayers() {
    if (!map.getSource(PRODUCT_SOURCE_ID)) {
      map.addSource(
        PRODUCT_SOURCE_ID,
        {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        }
      );
    }

    if (!map.getLayer(PRODUCT_POINT_LAYER_ID)) {
      map.addLayer({
        id: PRODUCT_POINT_LAYER_ID,
        type: 'circle',
        source: PRODUCT_SOURCE_ID,
        filter: [
          '==',
          ['geometry-type'],
          'Point'
        ],
        paint: {
          'circle-radius': 6,
          'circle-color': '#ef4444',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });
    }

    map.on(
      'click',
      PRODUCT_POINT_LAYER_ID,
      (e) => {
        const f = e.features && e.features[0];
        if (!f) {
          return;
        }

        const coords = f.geometry.coordinates.slice();
        const title = (f.properties && f.properties.title) ? f.properties.title : 'Marker';
        const desc = (f.properties && f.properties.description) ? f.properties.description : '';

        new mapboxgl.Popup()
          .setLngLat(coords)
          .setHTML(`<strong>${title}</strong><br/>${desc}`)
          .addTo(map);
      }
    );

    map.on('mouseenter', PRODUCT_POINT_LAYER_ID, () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', PRODUCT_POINT_LAYER_ID, () => {
      map.getCanvas().style.cursor = '';
    });
  }

  function parseLineStringToCoords(value) {
    let raw = value;

    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch (_) {
        return [];
      }
    }

    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch (_) {
        return [];
      }
    }

    const coords = Array.isArray(raw)
      ? raw.filter((p) => Array.isArray(p) && isValidLngLat(Number(p[0]), Number(p[1])))
      : [];

    return coords;
  }

  function ensureLinePositionLayer() {
    if (!map.getSource(LINE_POS_SOURCE_ID)) {
      map.addSource(
        LINE_POS_SOURCE_ID,
        {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        }
      );
    }

    if (!map.getLayer(LINE_POS_CIRCLE_LAYER_ID)) {
      map.addLayer({
        id: LINE_POS_CIRCLE_LAYER_ID,
        type: 'circle',
        source: LINE_POS_SOURCE_ID,
        paint: {
          // Use a single brand color for circles to match line color
          'circle-radius': 16,
          'circle-color': LINE_COLOR,
          'circle-stroke-color': LINE_COLOR,
          'circle-stroke-width': 2
        }
      });

      map.on('mouseenter', LINE_POS_CIRCLE_LAYER_ID, () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', LINE_POS_CIRCLE_LAYER_ID, () => {
        map.getCanvas().style.cursor = '';
      });
    }

    if (!map.getLayer(LINE_POS_TEXT_LAYER_ID)) {
      map.addLayer({
        id: LINE_POS_TEXT_LAYER_ID,
        type: 'symbol',
        source: LINE_POS_SOURCE_ID,
        layout: {
          // Safely render numeric position values; avoid type mismatch with coalesce
          'text-field': [
            'case',
            ['has', 'position'],
            ['to-string', ['get', 'position']],
            ''
          ],
          'text-size': 12,
          'text-font': [
            'Open Sans Bold',
            'Arial Unicode MS Bold'
          ],
          'text-allow-overlap': true,
          'text-anchor': 'center'
        },
        paint: {
          'text-color': '#ffffff'
        }
      });
    }
  }

  function pointsFcFromMarkers(markers) {
    const features = [];

    (markers || []).forEach((m) => {
      const lng = Number(m.longitude);
      const lat = Number(m.latitude);

      if (isValidLngLat(lng, lat)) {
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

  function linesFcFromMarkers(markers) {
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

  function midpointOfLine(coords) {
    if (!Array.isArray(coords) || coords.length < 2) {
      return null;
    }

    let total = 0;
    const segLens = [];

    for (let i = 0; i < coords.length - 1; i++) {
      const a = coords[i];
      const b = coords[i + 1];
      const L = Math.hypot(
        b[0] - a[0],
        b[1] - a[1]
      );

      segLens.push(L);
      total += L;
    }

    if (total === 0) {
      return coords[0];
    }

    let d = total / 2;

    for (let i = 0; i < segLens.length; i++) {
      if (d <= segLens[i]) {
        const a = coords[i];
        const b = coords[i + 1];
        const t = d / segLens[i];

        return [
          a[0] + t * (b[0] - a[0]),
          a[1] + t * (b[1] - a[1])
        ];
      }

      d -= segLens[i];
    }

    return coords[coords.length - 1];
  }

  function clearProductLinesInDraw() {
    if (!productLineDrawIds || productLineDrawIds.length === 0) {
      return;
    }

    productLineDrawIds.forEach((id) => {
      try {
        draw.delete(id);
      } catch (_) {
        // ignore
      }
    });

    productLineDrawIds = [];
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

  function refreshLinePositionOverlay(product, tempLinesFc) {
    ensureLinePositionLayer();

    const fc = buildLinePositionFeatures(
      product,
      tempLinesFc
    );

    const src = map.getSource(LINE_POS_SOURCE_ID);

    if (src) {
      src.setData(fc);
    }
  }

  async function openLinkModal(productId) {
    const overlay = document.getElementById('link-modal');
    const select = document.getElementById('marker-select');
    const saveBtn = document.getElementById('link-save');

    let errorEl = overlay.querySelector('.error');

    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.className = 'error';
      errorEl.style.display = 'none';
      errorEl.textContent = '';
      overlay.querySelector('.modal').appendChild(errorEl);
    }

    select.innerHTML = '';
    saveBtn.disabled = true;
    errorEl.style.display = 'none';
    errorEl.textContent = '';

    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');

    try {
      const res = await apiFetch(
        `/api/products/${productId}/markers-without-lines`,
        {
          credentials: 'same-origin'
        }
      );

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }

      const json = await res.json();
      const markers = json.markers || [];

      if (markers.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No available markers';
        opt.disabled = true;
        opt.selected = true;
        select.appendChild(opt);
      } else {
        markers.forEach((m) => {
          const opt = document.createElement('option');
          opt.value = String(m.id);
          opt.textContent = `${m.position} - ${m.title}`;
          select.appendChild(opt);
        });

        saveBtn.disabled = false;
      }

      return new Promise((resolve) => {
        const onCancel = () => {
          cleanup();
          resolve(null);
        };

        const onSave = () => {
          const id = select.value;
          cleanup();
          resolve(id || null);
        };

        const onKey = (e) => {
          if (e.key === 'Escape') {
            onCancel();
          }
        };

        const cleanup = () => {
          overlay.style.display = 'none';
          overlay.setAttribute('aria-hidden', 'true');

          document
            .getElementById('link-cancel')
            .removeEventListener('click', onCancel);

          document
            .getElementById('link-save')
            .removeEventListener('click', onSave);

          document
            .removeEventListener('keydown', onKey);
        };

        document
          .getElementById('link-cancel')
          .addEventListener('click', onCancel);

        document
          .getElementById('link-save')
          .addEventListener('click', onSave);

        document
          .addEventListener('keydown', onKey);
      });
    } catch (err) {
      errorEl.textContent = 'Failed to load available markers. Are you logged in?';
      errorEl.style.display = 'block';

      return new Promise((resolve) => {
        const onCancel = () => {
          cleanup();
          resolve(null);
        };

        const onKey = (e) => {
          if (e.key === 'Escape') {
            onCancel();
          }
        };

        const cleanup = () => {
          overlay.style.display = 'none';
          overlay.setAttribute('aria-hidden', 'true');

          document
            .getElementById('link-cancel')
            .removeEventListener('click', onCancel);

          document
            .removeEventListener('keydown', onKey);
        };

        document
          .getElementById('link-cancel')
          .addEventListener('click', onCancel);

        document
          .addEventListener('keydown', onKey);
      });
    }
  }

  async function saveLineToMarker(markerId, coords) {
    const res = await apiFetch(
      `/api/mapmarkers/${markerId}/lineString`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify({ lineString: coords })
      }
    );

    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || 'Failed to save line');
    }

    return await res.json();
  }

  map.on('click', LINE_POS_CIRCLE_LAYER_ID, async (e) => {
    const f = e.features && e.features[0];
    if (!f) {
      return;
    }

    const current = productsById.get(String(document.getElementById('product-select').value));
    if (!current) {
      return;
    }

    const isLinkedCircle = (f.properties && (String(f.properties.linked) === 'true' || f.properties.linked === true));

    let targetLine = null;
    let prevOwnerMarkerId = null;

    if (isLinkedCircle) {
      // Allow relinking by clicking the linked circle directly
      const markerId = f.properties && f.properties.markerId ? f.properties.markerId : null;
      if (!markerId) {
        return;
      }

      const drawData = draw.getAll();
      if (!drawData || !drawData.features) {
        return;
      }

      targetLine = (drawData.features || []).find((g) => {
        return (
          g &&
          g.geometry &&
          g.geometry.type === 'LineString' &&
          g.properties &&
          (String(g.properties.markerId) === String(markerId))
        );
      }) || null;

      prevOwnerMarkerId = markerId;
    } else {
      // Unlinked temp circle: find nearest unlinked line
      const drawData = draw.getAll();
      if (!drawData || !drawData.features) {
        return;
      }

      let minDist = Infinity;

      (drawData.features || []).forEach((g) => {
        if (!g.geometry || g.geometry.type !== 'LineString') {
          return;
        }
        if (g.properties && typeof g.properties.markerId !== 'undefined' && g.properties.markerId !== null) {
          return; // skip linked lines here
        }

        const mid = midpointOfLine(g.geometry.coordinates);
        if (!mid) {
          return;
        }

        const dx = mid[0] - f.geometry.coordinates[0];
        const dy = mid[1] - f.geometry.coordinates[1];
        const d = dx * dx + dy * dy;

        if (d < minDist) {
          minDist = d;
          targetLine = g;
        }
      });
    }

    if (!targetLine) {
      return;
    }

    const markerId = await openLinkModal(current.id);
    if (!markerId) {
      return;
    }

    try {
      // If the chosen marker already has a line in DB, clear it first
      const chosenMarker = (current.mapmarkers || current.mapMarkers || []).find((m) => {
        return String(m.id) === String(markerId);
      });

      if (chosenMarker && chosenMarker.lineString) {
        await saveLineToMarker(markerId, null);
      }

      // If we are moving from a previously linked marker, clear its DB line to avoid duplicates
      if (prevOwnerMarkerId) {
        await saveLineToMarker(prevOwnerMarkerId, null);
      } else {
        // Also handle case where the target temp line originated from a linked feature we tracked
        const trackedPrevOwner = drawIdToMarkerId.get(targetLine.id);
        if (trackedPrevOwner) {
          await saveLineToMarker(trackedPrevOwner, null);
        }
      }

      await saveLineToMarker(markerId, targetLine.geometry.coordinates);

      // Remove the temp/old line from the canvas; renderProduct will redraw the new linked one
      try { draw.delete(targetLine.id); } catch (_) {}
      productLineDrawIds = productLineDrawIds.filter((id) => id !== targetLine.id);

      // Reload fresh product data and render, keeping viewport
      const res = await fetch('/api/products?t=' + Date.now(), { cache: 'no-store' });
      const json = await res.json();
      const updated = (json.products || []).find((p) => String(p.id) === String(current.id));
      if (updated) {
        productsById.set(String(current.id), updated);
        renderProduct(updated, { keepViewport: true });
      }
    } catch (err) {
      alert('Failed to save: ' + err.message);
    }
  });

  function renderProduct(product, options = {}) {
    if (!product) {
      return;
    }

    const keepViewport = options && options.keepViewport === true;

    const markers = product.mapmarkers || product.mapMarkers || [];

    const existingLinesFc = linesFcFromMarkers(markers);
    const pointsFc = pointsFcFromMarkers(markers);

    clearProductLinesInDraw();
    drawIdToMarkerId.clear();

    if (existingLinesFc.features.length > 0) {
      const added = draw.add(existingLinesFc);
      const ids = Array.isArray(added) ? added : [added];

      productLineDrawIds.push(
        ...ids
      );

      // Rebuild ownership map: draw feature id -> markerId
      const currentData = draw.getAll();
      (currentData.features || []).forEach((f) => {
        if (
          f &&
          f.geometry &&
          f.geometry.type === 'LineString' &&
          f.properties &&
          (typeof f.properties.markerId !== 'undefined' && f.properties.markerId !== null)
        ) {
          drawIdToMarkerId.set(
            f.id,
            f.properties.markerId
          );
        }
      });
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

    refreshLinePositionOverlay(product, tempLinesFc);

    if (keepViewport) {
      return;
    }

    const lng = Number(product.defaultLongitude);
    const lat = Number(product.defaultLatitude);

    const hasCenter = isValidLngLat(lng, lat);
    const zoomConfigured = parseZoom(product.zoom);

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
        saveViewport();
      });
    } else if (hasCenter && zoomConfigured !== null) {
      map.flyTo({
        center: [
          lng,
          lat
        ],
        zoom: zoomConfigured,
        essential: true
      });

      map.once('moveend', () => {
        saveViewport();
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
          saveViewport();
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
          saveViewport();
        });
      }
    }
  }

  async function loadProducts(options = {}) {
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

  document.getElementById('copy-btn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(outputEl.value);

      const btn = document.getElementById('copy-btn');
      const prev = btn.textContent;

      btn.textContent = 'Copied!';

      setTimeout(() => {
        btn.textContent = prev;
      }, 1000);
    } catch (_) {
      alert('Copy failed. You can manually select and copy the text.');
    }
  });

  document.getElementById('clear-btn').addEventListener('click', () => {
    draw.deleteAll();
    productLineDrawIds = [];
    updateOutput();

    const current = productsById.get(
      String(document.getElementById('product-select').value)
    );

    if (current) {
      refreshLinePositionOverlay(
        current,
        {
          type: 'FeatureCollection',
          features: []
        }
      );
    }
  });

  document.getElementById('fit-btn').addEventListener('click', () => {
    fitToDrawings();
  });

  document.getElementById('product-select').addEventListener('change', (e) => {
    const id = e.target.value;

    localStorage.setItem(
      'poicustomization.selectedProductId',
      id
    );

    renderProduct(
      productsById.get(id)
    );
  });

  map.on('load', async () => {
    updateOutput();
    initProductLayers();
    ensureLinePositionLayer();

    attachLogoutHandler();

    const ok = await ensureAuthPermission();

    if (ok) {
      const hasVp = !!getSavedViewport();
      await loadProducts({ keepViewport: hasVp });
      // When a saved viewport exists, initial render keeps it. No need to re-apply.
    }
  });

  // Save viewport on interactions
  map.on('moveend', () => {
    saveViewport();
  });

  map.on('draw.create', () => {
    updateOutput();

    const current = productsById.get(String(document.getElementById('product-select').value));
    if (!current) {
      return;
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

    refreshLinePositionOverlay(current, tempLinesFc);
  });

  map.on('draw.delete', async (e) => {
    updateOutput();

    const current = productsById.get(String(document.getElementById('product-select').value));
    if (!current) {
      return;
    }

    const deleted = (e && e.features) ? e.features : [];
    const toClear = deleted.filter((f) => {
      return (
        f &&
        f.geometry &&
        f.geometry.type === 'LineString' &&
        f.properties &&
        (typeof f.properties.markerId !== 'undefined' && f.properties.markerId !== null)
      );
    });

    if (toClear.length === 0) {
      // just refresh overlay for temp lines (unlinked only)
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

      refreshLinePositionOverlay(current, tempLinesFc);
      return;
    }

    try {
      for (const f of toClear) {
        const markerId = f.properties.markerId;

        await saveLineToMarker(
          markerId,
          null
        );
      }

      // After clearing, reload product and re-render to stay in sync
      const res = await fetch('/api/products?t=' + Date.now(), { cache: 'no-store' });
      const json = await res.json();

      const updated = (json.products || []).find((p) => {
        return String(p.id) === String(current.id);
      });

      if (updated) {
        productsById.set(
          String(current.id),
          updated
        );

        renderProduct(updated, { keepViewport: true });
      }
    } catch (err) {
      alert('Failed to update deleted line(s): ' + err.message);
    }
  });

  map.on('draw.update', async (e) => {
    updateOutput();

    const current = productsById.get(String(document.getElementById('product-select').value));
    if (!current) {
      return;
    }

    const changed = (e && e.features) ? e.features : [];
    const toSave = changed.filter((f) => {
      return (
        f &&
        f.geometry &&
        f.geometry.type === 'LineString' &&
        f.properties &&
        (typeof f.properties.markerId !== 'undefined' && f.properties.markerId !== null)
      );
    });

    if (toSave.length === 0) {
      // refresh overlay for unlinked temp lines only
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

      refreshLinePositionOverlay(current, tempLinesFc);
      return;
    }

    try {
      for (const f of toSave) {
        const markerId = f.properties.markerId;
        const coords = f.geometry.coordinates;

        await saveLineToMarker(
          markerId,
          coords
        );
      }

      // Reload and re-render once after saves
      const res = await fetch('/api/products?t=' + Date.now(), { cache: 'no-store' });
      const json = await res.json();

      const updated = (json.products || []).find((p) => {
        return String(p.id) === String(current.id);
      });

      if (updated) {
        productsById.set(
          String(current.id),
          updated
        );

        renderProduct(updated, { keepViewport: true });
      }
    } catch (err) {
      alert('Failed to save updated line(s): ' + err.message);
    }
  });
});
