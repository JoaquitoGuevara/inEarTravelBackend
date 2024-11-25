<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\RegisteredUserController;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::post('login', [AuthenticatedSessionController::class, 'store']);
Route::post('register', [RegisteredUserController::class, 'store']);
Route::post('register/google', [RegisteredUserController::class, 'storeGoogleUser']);
Route::post('register/apple', [RegisteredUserController::class, 'storeAppleUser']);

Route::middleware('auth:sanctum')->group(function() {
    Route::post('logout', [AuthenticatedSessionController::class, 'destroy']);
});