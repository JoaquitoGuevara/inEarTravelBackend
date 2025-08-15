<?php

namespace App\Http\Controllers;

use App\Models\MapMarker;
use Illuminate\Http\Request;

class MapMarkerController extends Controller
{
    public function updateLineString(Request $request, MapMarker $mapmarker)
    {
        // Accept either an array of [lng, lat] pairs or a JSON string
        $data = $request->input('lineString');
        if (is_string($data)) {
            $decoded = json_decode($data, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $data = $decoded;
            }
        }

        if (!is_array($data) || count($data) < 2) {
            return response()->json(['message' => 'Invalid lineString. Expect an array of [lng, lat] coordinates.'], 422);
        }

        // Basic shape validation
        foreach ($data as $pt) {
            if (!is_array($pt) || count($pt) < 2) {
                return response()->json(['message' => 'Invalid coordinate in lineString.'], 422);
            }
            $lng = floatval($pt[0]);
            $lat = floatval($pt[1]);
            if ($lng < -180 || $lng > 180 || $lat < -90 || $lat > 90) {
                return response()->json(['message' => 'Coordinate out of range in lineString.'], 422);
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
}
