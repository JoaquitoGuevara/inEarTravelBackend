<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>POI Customization</title>

  <!-- Mapbox GL JS (via CDN) -->
  <link href="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css" rel="stylesheet">
  <script src="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js"></script>

  <!-- Mapbox GL Draw (drawing tools) -->
  <link rel="stylesheet" href="https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v1.4.3/mapbox-gl-draw.css" type="text/css">
  <script src="https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v1.4.3/mapbox-gl-draw.js"></script>

  <link rel="stylesheet" href="/dist/css/poicustomization.css">
</head>
<body>
  <div id="app">
    <div id="map"></div>
    <aside class="panel">
      <h2 style="margin:0 0 4px 0; font-size:16px;">POI Customization</h2>
      <div class="field">
        <label for="product-select" style="font-size:12px; color:#6b7280;">Select product</label>
        <select id="product-select" class="sel">
          <option value="" disabled selected>Loading products...</option>
        </select>
      </div>
      <div class="hint">
        • Use the toolbar on the map to draw Lines or Polygons (multiple features supported).<br/>
        • Click a shape to edit its vertices. Use Trash to remove selected shapes.<br/>
        • Combine/Uncombine lets you merge multi-features when applicable.
      </div>
      <div class="actions">
        <button id="fit-btn" class="btn secondary" type="button">Fit to drawings</button>
        <button id="copy-btn" class="btn" type="button">Copy GeoJSON</button>
        <button id="clear-btn" class="btn secondary" type="button">Clear all</button>
      </div>
      <label style="font-size:12px; color:#6b7280;">Current Drawings (GeoJSON FeatureCollection)</label>
      <textarea id="output" readonly>{
  "type": "FeatureCollection",
  "features": []
}</textarea>
    </aside>
  </div>

  <div id="link-modal" class="modal-overlay" aria-hidden="true">
    <div class="modal">
      <h3>Link line to marker</h3>
      <div class="row">
        <label for="marker-select" style="font-size:12px; color:#6b7280;">Choose marker</label>
        <select id="marker-select" class="sel"></select>
      </div>
      <div class="actions">
        <button id="link-cancel" class="btn secondary" type="button">Cancel</button>
        <button id="link-save" class="btn" type="button">Save</button>
      </div>
    </div>
  </div>

  <script src="/dist/js/poicustomization.js"></script>
</body>
</html>
