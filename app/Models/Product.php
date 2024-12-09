<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    protected $fillable = ['name', 'price', 'audioFile', 'photo'];

    protected $hidden = ['audioFile'];

    public function users()
    {
        return $this->belongsToMany(User::class, 'product_user');
    }
}
