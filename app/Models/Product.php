<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    protected $fillable = ['name', 'price', 'audioFile', 'photo', 'squarePhoto', 'description', 'iapProductId', 
                            'sampleAudioFile', 'defaultLongitude', 'defaultLatitude', 'defaultLongitudeDelta', 'defaultLatitudeDelta',
                            'estimatedDuration', 'totalCoveredDistance', 'beforeYouGoText', 'ratingsAvg'];

    protected $hidden = ['audioFile', 'sampleAudioFile'];

    public function users()
    {
        return $this->belongsToMany(User::class, 'product_user')->withPivot('audioFile, timesShared');
    }

    public function usersWhoFavorited()
    {
        return $this->belongsToMany(User::class, 'product_favorite_user');
    }

    public function timestamps()
    {
        return $this->hasMany(AudioTimestamp::class);
    }

    public function pendingShareDestinations()
    {
        return $this->hasMany(PendingShareDestination::class);
    }
    
    /**
     * Get the map markers for the product.
     */
    public function mapMarkers()
    {
        return $this->hasMany(MapMarker::class);
    }
}
