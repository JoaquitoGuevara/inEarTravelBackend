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

  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: [
      -88.5678,
      20.6829
    ],
    zoom: 12
  });

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

    outputEl.value = JSON.stringify(
      data,
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
          'circle-radius': 12,
          'circle-color': [
            'case',
            ['==', ['get', 'linked'], true],
            '#111827',
            '#ffffff'
          ],
          'circle-stroke-color': '#111827',
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
          'text-field': ['to-string', ['coalesce', ['get', 'position'], '']],
          'text-size': 12,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': true,
          'text-anchor': 'center'
        },
        paint: {
          'text-color': [
            'case',
            ['==', ['get', 'linked'], true],
            '#ffffff',
            '#111827'
          ]
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
            geometry: {
              type: 'Point',
              coordinates: mid
            },
            properties: {
              linked: true,
              position: m.position,
              markerId: m.id,
              title: m.title || ''
            }
          });
        }
      }
    });

    (tempLinesFc.features || []).forEach((f, idx) => {
      if (!f || !f.geometry || f.geometry.type !== 'LineString') {
        return;
      }

      const mid = midpointOfLine(f.geometry.coordinates);
      if (!mid) {
        return;
      }

      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: mid
        },
        properties: {
          linked: false,
          tempDrawId: f.id || null,
          tempIndex: idx
        }
      });
    });

    return {
      type: 'FeatureCollection',
      features
    };
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

    if (f.properties && String(f.properties.linked) === 'true') {
      return;
    }

    const current = productsById.get(
      String(document.getElementById('product-select').value)
    );

    if (!current) {
      return;
    }

    const drawData = draw.getAll();

    if (!drawData || !drawData.features) {
      return;
    }

    let targetLine = null;
    let minDist = Infinity;

    drawData.features.forEach((g) => {
      if (!g.geometry || g.geometry.type !== 'LineString') {
        return;
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

    if (!targetLine) {
      return;
    }

    const markerId = await openLinkModal(current.id);

    if (!markerId) {
      return;
    }

    try {
      await saveLineToMarker(
        markerId,
        targetLine.geometry.coordinates
      );

      draw.delete(targetLine.id);

      productLineDrawIds = productLineDrawIds.filter((id) => {
        return id !== targetLine.id;
      });

      const res = await fetch('/api/products');
      const json = await res.json();

      const updated = (json.products || []).find((p) => {
        return String(p.id) === String(current.id);
      });

      if (updated) {
        productsById.set(
          String(current.id),
          updated
        );

        renderProduct(updated);
      }
    } catch (err) {
      alert('Failed to save: ' + err.message);
    }
  });

  function renderProduct(product) {
    if (!product) {
      return;
    }

    const markers = product.mapmarkers || product.mapMarkers || [];

    const existingLinesFc = linesFcFromMarkers(markers);
    const pointsFc = pointsFcFromMarkers(markers);

    clearProductLinesInDraw();

    if (existingLinesFc.features.length > 0) {
      const added = draw.add(existingLinesFc);
      const ids = Array.isArray(added) ? added : [added];

      productLineDrawIds.push(
        ...ids
      );
    }

    const src = map.getSource(PRODUCT_SOURCE_ID);

    if (src) {
      src.setData(pointsFc);
    }

    const tempData = draw.getAll();

    const tempLinesFc = {
      type: 'FeatureCollection',
      features: (tempData.features || []).filter((f) => {
        return f.geometry && f.geometry.type === 'LineString';
      })
    };

    refreshLinePositionOverlay(
      product,
      tempLinesFc
    );

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
    } else if (hasCenter && zoomConfigured !== null) {
      map.flyTo({
        center: [
          lng,
          lat
        ],
        zoom: zoomConfigured,
        essential: true
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
      } else if (hasCenter) {
        map.flyTo({
          center: [
            lng,
            lat
          ],
          zoom: 15,
          essential: true
        });
      }
    }
  }

  async function loadProducts() {
    const selectEl = document.getElementById('product-select');

    try {
      const res = await fetch('/api/products');
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
        renderProduct(selected);
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
      loadProducts();
    }
  });

  map.on('draw.create', () => {
    updateOutput();

    const current = productsById.get(
      String(document.getElementById('product-select').value)
    );

    if (!current) {
      return;
    }

    const tempData = draw.getAll();

    const tempLinesFc = {
      type: 'FeatureCollection',
      features: (tempData.features || []).filter((f) => {
        return f.geometry && f.geometry.type === 'LineString';
      })
    };

    refreshLinePositionOverlay(
      current,
      tempLinesFc
    );
  });

  map.on('draw.delete', () => {
    updateOutput();

    const current = productsById.get(
      String(document.getElementById('product-select').value)
    );

    if (!current) {
      return;
    }

    const tempData = draw.getAll();

    const tempLinesFc = {
      type: 'FeatureCollection',
      features: (tempData.features || []).filter((f) => {
        return f.geometry && f.geometry.type === 'LineString';
      })
    };

    refreshLinePositionOverlay(
      current,
      tempLinesFc
    );
  });

  map.on('draw.update', () => {
    updateOutput();

    const current = productsById.get(
      String(document.getElementById('product-select').value)
    );

    if (!current) {
      return;
    }

    const tempData = draw.getAll();

    const tempLinesFc = {
      type: 'FeatureCollection',
      features: (tempData.features || []).filter((f) => {
        return f.geometry && f.geometry.type === 'LineString';
      })
    };

    refreshLinePositionOverlay(
      current,
      tempLinesFc
    );
  });
});
