<?php

use App\Http\Controllers\AudioDownloadController;
use App\Http\Controllers\ProductController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\RegisteredUserController;

Route::post('login', [AuthenticatedSessionController::class, 'store']);
Route::post('register', [RegisteredUserController::class, 'store']);
Route::post('register/google', [RegisteredUserController::class, 'storeGoogleUser']);
Route::post('register/apple', [RegisteredUserController::class, 'storeAppleUser']);

Route::middleware('auth:sanctum')->group(function() {
    Route::post('logout', [AuthenticatedSessionController::class, 'destroy']);
    Route::get('userdata', [AuthenticatedSessionController::class, 'userdata']);

    Route::get('products', [ProductController::class, 'index']);
    Route::get('myAudios/{id}/downloadUrl', [AudioDownloadController::class, 'getPresignedUrlForAudio']);
    Route::get('myAudios', [ProductController::class, 'getForUser']);
});
