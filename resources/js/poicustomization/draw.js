/* Use global MapboxDraw (loaded by the page) to avoid adding new bundler deps */
import {
  LINE_POS_SOURCE_ID,
  LINE_POS_CIRCLE_LAYER_ID,
  LINE_POS_TEXT_LAYER_ID
} from './constants.js';

let draw = null;
let productLineDrawIds = [];
const drawIdToMarkerId = new Map();

export function createDraw(map) {
  if (draw) return draw;

  draw = new MapboxDraw({
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

  map.addControl(draw, 'top-left');

  return draw;
}

export function clearProductLinesInDraw() {
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

export function registerDrawId(id, markerId) {
  if (!drawIdToMarkerId) return;
  drawIdToMarkerId.set(id, markerId);
}

export function rebuildOwnershipMap() {
  if (!draw) return;
  drawIdToMarkerId.clear();

  const currentData = draw.getAll();
  (currentData.features || []).forEach((f) => {
    if (
      f &&
      f.geometry &&
      f.geometry.type === 'LineString' &&
      f.properties &&
      (typeof f.properties.markerId !== 'undefined' && f.properties.markerId !== null)
    ) {
      drawIdToMarkerId.set(f.id, f.properties.markerId);
    }
  });
}

export function pushProductLineIds(ids) {
  productLineDrawIds.push(...(Array.isArray(ids) ? ids : [ids]));
}

export function getProductLineDrawIds() {
  return productLineDrawIds;
}

export function ensureLinePositionLayer(map, LINE_COLOR) {
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

export function setLinePositionData(map, fc) {
  const src = map.getSource(LINE_POS_SOURCE_ID);
  if (src) {
    src.setData(fc);
  }
}

export function getDrawInstance() {
  return draw;
}
