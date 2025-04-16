<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MapMarkerImage extends Model
{
    protected $fillable = [
        'map_marker_id',
        'image_url'
    ];

    public function mapMarker()
    {
        return $this->belongsTo(MapMarker::class);
    }
}
