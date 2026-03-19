<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\EngineerAtmController;
use App\Http\Controllers\Api\JobCardController;
use Illuminate\Support\Facades\Route;

// ── Public ────────────────────────────────────────────────────────────────────
Route::post('/auth/login', [AuthController::class, 'login']);

// ── Authenticated (Sanctum) ───────────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    Route::get ('/auth/me',     [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::get('/my-atms', [EngineerAtmController::class, 'index']);

    Route::get   ('/job-cards',                  [JobCardController::class, 'index']);
    Route::post  ('/job-cards',                  [JobCardController::class, 'store']);
    Route::get   ('/job-cards/{jobCard}',        [JobCardController::class, 'show']);
    Route::put   ('/job-cards/{jobCard}',        [JobCardController::class, 'update']);
    Route::delete('/job-cards/{jobCard}',        [JobCardController::class, 'destroy']);
    Route::post  ('/job-cards/{jobCard}/photos', [JobCardController::class, 'uploadPhotos']);
    Route::post  ('/job-cards/{jobCard}/submit', [JobCardController::class, 'submit']);

    Route::prefix('admin')->group(function () {
        Route::get ('/job-cards',                   [JobCardController::class, 'adminIndex']);
        Route::post('/job-cards/{jobCard}/approve', [JobCardController::class, 'approve']);
        Route::post('/job-cards/{jobCard}/reject',  [JobCardController::class, 'reject']);
    });
});
