<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AudioTimestamp extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id',
        'start_timestamp',
        'end_timestamp',
    ];

    /**
     * Define the relationship to the Audio model (belongsTo).
     */
    public function audio()
    {
        return $this->belongsTo(Product::class);
    }
}
