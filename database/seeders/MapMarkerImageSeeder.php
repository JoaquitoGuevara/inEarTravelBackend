<?php

namespace Database\Seeders;

use App\Models\MapMarker;
use App\Models\MapMarkerImage;
use Illuminate\Database\Seeder;

class MapMarkerImageSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $mapMarkers = MapMarker::all();

        foreach ($mapMarkers as $mapMarker) {
            MapMarkerImage::create([
                'map_marker_id' => $mapMarker->id,
                'image_url' => 'https://www.cometoparis.com/data/layout_image/58776_19503_2.800w_landscape_3-2_xl.jpg?ver=1739361702'
            ]);

            MapMarkerImage::create([
                'map_marker_id' => $mapMarker->id,
                'image_url' => 'https://www.travelandleisure.com/thmb/SPUPzO88ZXq6P4Sm4mC5Xuinoik=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/eiffel-tower-paris-france-EIFFEL0217-6ccc3553e98946f18c893018d5b42bde.jpg'
            ]);

            MapMarkerImage::create([
                'map_marker_id' => $mapMarker->id,
                'image_url' => 'https://carreteandoblog.com/wp-content/uploads/2022/02/eiffel-tower-scaled.jpg.webp'
            ]);
        }
    }
}
