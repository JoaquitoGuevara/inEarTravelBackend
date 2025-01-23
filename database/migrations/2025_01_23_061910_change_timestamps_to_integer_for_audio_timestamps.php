<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('audio_timestamps', function (Blueprint $table) {
            $table->unsignedBigInteger('start_timestamp')->change();  
            $table->unsignedBigInteger('end_timestamp')->change();  
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        
    }
};
