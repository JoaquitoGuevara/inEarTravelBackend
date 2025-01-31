<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    protected $fillable = ['name', 'price', 'audioFile', 'photo', 'description', 'iapProductId', 'sampleAudioFile'];

    protected $hidden = ['audioFile', 'sampleAudioFile'];

    public function users()
    {
        return $this->belongsToMany(User::class, 'product_user')->withPivot('audioFile, timesShared');
    }

    public function timestamps()
    {
        return $this->hasMany(AudioTimestamp::class);
    }

    public function pendingShareDestinations()
    {
        return $this->hasMany(PendingShareDestination::class);
    }
}
