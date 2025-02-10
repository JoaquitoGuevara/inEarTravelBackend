<?php

use App\Http\Controllers\EmailVerificationController;
use Illuminate\Support\Facades\Route;

Route::get('/email/verify/{id}/{hash}', [EmailVerificationController::class, 'verify'])
    ->middleware('signed')
    ->name('email.verify');

Route::view('/', 'landing');
Route::redirect('/download', 'https://play.google.com/store/apps/details?id=com.ldkmexico.ineartravel');
