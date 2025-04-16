<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MapMarker extends Model
{
    protected $fillable = [
        'product_id',
        'title',
        'description',
        'latitude',
        'longitude',
        'audioFile'
    ];

    /**
     * Get the product that owns the map marker.
     */
    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function mapMarkerImages()
    {
        return $this->hasMany(MapMarkerImage::class);
    }
}
