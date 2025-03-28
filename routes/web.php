<?php

use App\Http\Controllers\EmailVerificationController;
use Illuminate\Support\Facades\Route;

Route::get('/email/verify/{id}/{hash}', [EmailVerificationController::class, 'verify'])
    ->middleware('signed')
    ->name('email.verify');

Route::view('/', 'landing');
Route::view('/privacy', 'privacy');
Route::view('/tos', 'tos');
Route::view('/download', 'download');
Route::view('/accountdeletion', 'accountdeletion');