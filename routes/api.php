<?php

use App\Http\Controllers\AudioDownloadController;
use App\Http\Controllers\InAppPurchaseController;
use App\Http\Controllers\ProductController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\RegisteredUserController;

Route::post('login', [AuthenticatedSessionController::class, 'store']);
Route::post('register', [RegisteredUserController::class, 'store']);
Route::post('register/google', [RegisteredUserController::class, 'storeGoogleUser']);
Route::post('register/apple', [RegisteredUserController::class, 'storeAppleUser']);
Route::post('register/facebook', [RegisteredUserController::class, 'storeFacebookUser']);
Route::post('testemail', [RegisteredUserController::class, 'testEmail']);

Route::middleware('auth:sanctum')->group(function() {
    Route::post('logout', [AuthenticatedSessionController::class, 'destroy']);
    Route::get('userdata', [AuthenticatedSessionController::class, 'userdata']);

    Route::get('products', [ProductController::class, 'index']);
    Route::get('myAudios/{id}/downloadUrl', [AudioDownloadController::class, 'getPresignedUrlForAudio']);
    Route::get('myAudios/{id}/downloadSampleUrl', [AudioDownloadController::class, 'getPresignedUrlForSampleAudio']);
    Route::get('myAudios', [ProductController::class, 'getForUser']);
    Route::get('validate-coupon', [ProductController::class, 'validateCoupon']);

    Route::post('verify-iap', [InAppPurchaseController::class, 'verifyIap']);
});
