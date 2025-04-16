<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\MapMarker;
use App\Models\Product;

class MapMarkerSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $products = Product::all();
        
        if ($products->isEmpty()) {
            $this->command->info('No products found.');
            return;
        }
        
        $chichenItzaProduct = $products->where('iapProductId', 'chichenitzaaudioguide')->first();
        
        MapMarker::create([
            'product_id' => $chichenItzaProduct->id,
            'title' => 'El Castillo (Main Pyramid)',
            'description' => 'This is a placeholder description until each map marker has an official description provided to replace this one',
            'latitude' => 20.214675,
            'longitude' => -87.429059,
            'audioFile' => '250116_audio_guide_sample.mp3',
        ]);

        MapMarker::create([
            'product_id' => $chichenItzaProduct->id,
            'title' => 'Cenote Manati',
            'description' => 'This is a placeholder description until each map marker has an official description provided to replace this one',
            'latitude' => 20.216119134743348,
            'longitude' => -87.42834808924611,
            'audioFile' => '250116_audio_guide_sample.mp3',
        ]);

        MapMarker::create([
            'product_id' => $chichenItzaProduct->id,
            'title' => 'The Wall of Tulum',
            'description' => 'This is a placeholder description until each map marker has an official description provided to replace this one',
            'latitude' => 20.21658571726575,
            'longitude' => -87.42890620828207,
            'audioFile' => '250116_audio_guide_sample.mp3',
        ]);

        MapMarker::create([
            'product_id' => $chichenItzaProduct->id,
            'title' => 'View point 1 overlooking entire site',
            'description' => 'This is a placeholder description until each map marker has an official description provided to replace this one',
            'latitude' => 20.21599603664706,
            'longitude' => -87.42821166877212,
            'audioFile' => '250116_audio_guide_sample.mp3',
        ]);

        MapMarker::create([
            'product_id' => $chichenItzaProduct->id,
            'title' => 'Casa del Noreste',
            'description' => 'This is a placeholder description until each map marker has an official description provided to replace this one',
            'latitude' => 20.216231825601078,
            'longitude' => -87.42899136293906,
            'audioFile' => '250116_audio_guide_sample.mp3',
        ]);

        MapMarker::create([
            'product_id' => $chichenItzaProduct->id,
            'title' => 'Gran Plataforma',
            'description' => 'This is a placeholder description until each map marker has an official description provided to replace this one',
            'latitude' => 20.216095909058268,
            'longitude' => -87.42907048810302,
            'audioFile' => '250116_audio_guide_sample.mp3',
        ]);

        MapMarker::create([
            'product_id' => $chichenItzaProduct->id,
            'title' => 'Templo del Dios del Viento',
            'description' => 'This is a placeholder description until each map marker has an official description provided to replace this one',
            'latitude' => 20.215522037892956,
            'longitude' => -87.42838518371038,
            'audioFile' => '250116_audio_guide_sample.mp3',
        ]);

        MapMarker::create([
            'product_id' => $chichenItzaProduct->id,
            'title' => 'Playa / Port of Tulum',
            'description' => 'This is a placeholder description until each map marker has an official description provided to replace this one',
            'latitude' => 20.215342073470833,
            'longitude' => -87.42854343404156,
            'audioFile' => '250116_audio_guide_sample.mp3',
        ]);

        MapMarker::create([
            'product_id' => $chichenItzaProduct->id,
            'title' => 'Casa Halach Uinik',
            'description' => 'This is a placeholder description until each map marker has an official description provided to replace this one',
            'latitude' => 20.21519231271613,
            'longitude' => -87.42909865130045,
            'audioFile' => '250116_audio_guide_sample.mp3',
        ]);

        MapMarker::create([
            'product_id' => $chichenItzaProduct->id,
            'title' => 'Casa Halach Uinik',
            'description' => 'This is a placeholder description until each map marker has an official description provided to replace this one',
            'latitude' => 20.215243910976564,
            'longitude' => -87.429456726195,
            'audioFile' => '250116_audio_guide_sample.mp3',
        ]);

        MapMarker::create([
            'product_id' => $chichenItzaProduct->id,
            'title' => 'Casa del Chultun',
            'description' => 'This is a placeholder description until each map marker has an official description provided to replace this one',
            'latitude' => 20.21485300371544,
            'longitude' => -87.42967233952614,
            'audioFile' => '250116_audio_guide_sample.mp3',
        ]);

        MapMarker::create([
            'product_id' => $chichenItzaProduct->id,
            'title' => 'Templo de los Frascos',
            'description' => 'This is a placeholder description until each map marker has an official description provided to replace this one',
            'latitude' => 20.214780640114796,
            'longitude' => -87.42968105670522,
            'audioFile' => '250116_audio_guide_sample.mp3',
        ]);

        MapMarker::create([
            'product_id' => $chichenItzaProduct->id,
            'title' => 'Plataforma Funeraria',
            'description' => 'This is a placeholder description until each map marker has an official description provided to replace this one',
            'latitude' => 20.21468876975324,
            'longitude' => -87.42974811192792,
            'audioFile' => '250116_audio_guide_sample.mp3',
        ]);

        MapMarker::create([
            'product_id' => $chichenItzaProduct->id,
            'title' => 'View point 2 - overlook site and ocean',
            'description' => 'This is a placeholder description until each map marker has an official description provided to replace this one',
            'latitude' => 20.214286678977388,
            'longitude' => -87.42898904678187,
            'audioFile' => '250116_audio_guide_sample.mp3',
        ]);

        MapMarker::create([
            'product_id' => $chichenItzaProduct->id,
            'title' => 'View point 3 - overlook beach and Templo de Dios del Viento',
            'description' => 'This is a placeholder description until each map marker has an official description provided to replace this one',
            'latitude' => 20.214882578396978,
            'longitude' => -87.42870003875943,
            'audioFile' => '250116_audio_guide_sample.mp3',
        ]);

        MapMarker::create([
            'product_id' => $chichenItzaProduct->id,
            'title' => 'Temple / Watch tower',
            'description' => 'This is a placeholder description until each map marker has an official description provided to replace this one',
            'latitude' => 20.213181795279503,
            'longitude' => -87.4292146119358,
            'audioFile' => '250116_audio_guide_sample.mp3',
        ]);
    }
}
