<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class DistanceMatrixController extends Controller
{
    /**
     * POST /api/distance-matrix
     * Body:
     *   - myLatitude: float
     *   - myLongitude: float
    *   - locations: [{ latitude: float, longitude: float }, ...]
    *   - units: 'metric' | 'imperial' (optional, default: 'metric')
     *
     * Response:
     *   { distances: [{ distance: float|null }, ...] }
     */
    public function calculateDistances(Request $request)
    {
        $validated = $request->validate([
            'myLatitude' => 'required|numeric|between:-90,90',
            'myLongitude' => 'required|numeric|between:-180,180',
            'locations' => 'required|array|min:1',
            'locations.*.latitude' => 'required|numeric|between:-90,90',
            'locations.*.longitude' => 'required|numeric|between:-180,180',
            'units' => 'sometimes|string|in:metric,imperial',
        ]);

        $apiKey = env('DISTANCE_MATRIX_API_KEY');

        if (!$apiKey) {
            return response()->json([
                'message' => 'Distance Matrix API key is not configured.'
            ], 500);
        }

    $origin = $validated['myLatitude'] . ',' . $validated['myLongitude'];
        $locations = $validated['locations'];
    $units = $validated['units'] ?? 'metric';

        // Google Distance Matrix free tier allows up to 100 elements per request.
        // With 1 origin, we can send up to 100 destinations safely per call.
        $chunks = array_chunk($locations, 100);

        $distances = [];

        foreach ($chunks as $chunk) {
            $destinations = [];

            foreach ($chunk as $loc) {
                $destinations[] = $loc['latitude'] . ',' . $loc['longitude'];
            }

            $query = [
                'origins' => $origin,
                'destinations' => implode('|', $destinations),
                'units' => $units,
                'mode' => 'driving',
                'key' => $apiKey,
            ];

            $response = Http::retry(2, 250)
                ->get('https://maps.googleapis.com/maps/api/distancematrix/json', $query);

            if (!$response->successful()) {
                return response()->json([
                    'message' => 'Failed to fetch distances from Google.',
                    'details' => $response->body(),
                ], 502);
            }

            $payload = $response->json();

            if (!isset($payload['rows'][0]['elements']) || !is_array($payload['rows'][0]['elements'])) {
                return response()->json([
                    'message' => 'Unexpected response from Google Distance Matrix API.'
                ], 502);
            }

            $elements = $payload['rows'][0]['elements'];

            foreach ($elements as $element) {
                $distanceValue = null;

                if (isset($element['status']) && $element['status'] === 'OK') {
                    if (isset($element['distance']['value'])) {
                        // Google returns distance.value in meters regardless of 'units'.
                        $meters = (float) $element['distance']['value'];

                        if ($units === 'imperial') {
                            // Convert meters to miles.
                            $distanceValue = $meters / 1609.344;
                        } else {
                            // Convert meters to kilometers.
                            $distanceValue = $meters / 1000.0;
                        }
                    }
                }

                $distances[] = [
                    'distance' => $distanceValue,
                ];
            }
        }

    return response()->json($distances);
    }
}
