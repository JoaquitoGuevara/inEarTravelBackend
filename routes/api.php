<?php

use App\Http\Controllers\AudioDownloadController;
use App\Http\Controllers\InAppPurchaseController;
use App\Http\Controllers\ProductController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\RegisteredUserController;

Route::post('login', [AuthenticatedSessionController::class, 'store']);
Route::post('account/requestDeletion', [AuthenticatedSessionController::class, 'requestDeletion']);
Route::post('register', [RegisteredUserController::class, 'store']);
Route::post('register/google', [RegisteredUserController::class, 'storeGoogleUser']);
Route::post('register/apple', [RegisteredUserController::class, 'storeAppleUser']);
Route::post('register/facebook', [RegisteredUserController::class, 'storeFacebookUser']);
Route::post('testemail', [RegisteredUserController::class, 'testEmail']);

Route::get('products', [ProductController::class, 'index']);
Route::post('guest/myAudios', [ProductController::class, 'getForGuest']);
Route::post('guest/myAudios/{id}/downloadUrl', [AudioDownloadController::class, 'getPresignedUrlForAudioForGuest']);
Route::get('myAudios/{id}/downloadSampleUrl', [AudioDownloadController::class, 'getPresignedUrlForSampleAudio']);
Route::get('validate-coupon', [ProductController::class, 'validateCoupon']);

Route::middleware('auth:sanctum')->group(function() {
    Route::post('logout', [AuthenticatedSessionController::class, 'destroy']);
    Route::get('userdata', [AuthenticatedSessionController::class, 'userdata']);
    Route::post('setExpoPushToken', [AuthenticatedSessionController::class, 'setExpoPushToken']);
    Route::post('account/delete', [AuthenticatedSessionController::class, 'deleteAccount']);

    Route::get('myAudios/{id}/downloadUrl', [AudioDownloadController::class, 'getPresignedUrlForAudio']);
    Route::get('myAudios', [ProductController::class, 'getForUser']);
    Route::post('product/{product}/share', [ProductController::class, 'share']);
    Route::get('product/{product}/verifyOwnership', [ProductController::class, 'isOwnedByExistingUser']);
    Route::post('product/{product}/redeem', [ProductController::class, 'redeemProductWithCode']);

    Route::post('verify-iap', [InAppPurchaseController::class, 'verifyIap']);
    Route::post('verify-iap-for-share', [InAppPurchaseController::class, 'verifyIapForShare']);
});
