<?php

namespace App\Http\Controllers;

use App\Models\MapMarker;
use Illuminate\Http\Request;

class MapMarkerController extends Controller
{
    public function updateLineString(Request $request, MapMarker $mapmarker)
    {
        // Accepts: array of [lng, lat] pairs, a JSON string, or null/empty to clear
        $data = $request->input('lineString');

        // Normalize string inputs
        if (is_string($data)) {
            $trimmed = trim($data);

            if ($trimmed === '' || strtolower($trimmed) === 'null') {
                $data = null;
            } else {
                $decoded = json_decode($trimmed, true);

                if (json_last_error() === JSON_ERROR_NONE) {
                    $data = $decoded;
                }
            }
        }

        // Clear if null or empty array
        if ($data === null || (is_array($data) && count($data) === 0)) {
            $mapmarker->lineString = null;
            $mapmarker->save();

            return response()->json([
                'status' => 'ok',
                'mapmarker' => $mapmarker
            ]);
        }

        // Validate a non-empty array of coordinates
        if (!is_array($data) || count($data) < 2) {
            return response()->json([
                'message' => 'Invalid lineString. Expect an array of [lng, lat] coordinates.'
            ], 422);
        }

        foreach ($data as $pt) {
            if (!is_array($pt) || count($pt) < 2) {
                return response()->json([
                    'message' => 'Invalid coordinate in lineString.'
                ], 422);
            }

            $lng = floatval($pt[0]);
            $lat = floatval($pt[1]);

            if ($lng < -180 || $lng > 180 || $lat < -90 || $lat > 90) {
                return response()->json([
                    'message' => 'Coordinate out of range in lineString.'
                ], 422);
            }
        }

        // Persist as JSON string
        $mapmarker->lineString = json_encode($data);
        $mapmarker->save();

        return response()->json([
            'status' => 'ok',
            'mapmarker' => $mapmarker
        ]);
    }

    /**
     * Update the stored latitude/longitude for a map marker.
     * Accepts JSON { latitude: <number|null>, longitude: <number|null> }
     */
    public function updatePosition(Request $request, MapMarker $mapmarker)
    {
        $lat = $request->input('latitude');
        $lng = $request->input('longitude');

        // Allow clearing
        if ($lat === null || $lng === null) {
            $mapmarker->latitude = null;
            $mapmarker->longitude = null;
            $mapmarker->save();

            return response()->json(['status' => 'ok', 'mapmarker' => $mapmarker]);
        }

        $lat = floatval($lat);
        $lng = floatval($lng);

        if ($lng < -180 || $lng > 180 || $lat < -90 || $lat > 90) {
            return response()->json(['message' => 'Invalid coordinates'], 422);
        }

        $mapmarker->latitude = $lat;
        $mapmarker->longitude = $lng;
        $mapmarker->save();

        return response()->json(['status' => 'ok', 'mapmarker' => $mapmarker]);
    }
}
