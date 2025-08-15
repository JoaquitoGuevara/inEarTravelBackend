export function isValidLngLat(lng, lat) {
  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

export function parseZoom(z) {
  const n = Number(z);

  if (!Number.isFinite(n)) {
    return null;
  }
  if (n < 1 || n > 22) {
    return null;
  }

  return n;
}

export function parseLineStringToCoords(value) {
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

export function midpointOfLine(coords) {
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

export function boundsFromFeatureCollection(fc) {
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
