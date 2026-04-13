<?php
// routes/api.php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AtmController;
use App\Http\Controllers\MaintenanceController;
use App\Http\Controllers\EngineerController;

/*
|--------------------------------------------------------------------------
| NCR ATM Fleet Manager — API Routes
|--------------------------------------------------------------------------
|
| All routes are prefixed with /api (configured in bootstrap/app.php)
| and return JSON responses.
|
*/

// ── Dashboard ──────────────────────────────────────────────────────────────
Route::get('/stats', [AtmController::class, 'stats']);

// ── ATMs ───────────────────────────────────────────────────────────────────
Route::apiResource('atms', AtmController::class);
// GET    /api/atms           → index  (supports ?search=, ?status=, ?engineer_id=)
// POST   /api/atms           → store
// GET    /api/atms/{id}      → show   (includes maintenance records)
// PUT    /api/atms/{id}      → update
// DELETE /api/atms/{id}      → destroy

// ── Maintenance ────────────────────────────────────────────────────────────
// Native JSON maintenance endpoints have been moved into auth:sanctum
// below, using Api\MaintenanceController.

// ── Engineers ──────────────────────────────────────────────────────────────
Route::apiResource('engineers', EngineerController::class);
// GET    /api/engineers       → index  (supports ?region=)
// POST   /api/engineers       → store
// GET    /api/engineers/{id}  → show   (includes assigned ATMs)
// PUT    /api/engineers/{id}  → update
// DELETE /api/engineers/{id}  → destroy

// ── Mobile Engineer App APIs ───────────────────────────────────────────────
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\EngineerAtmController;
use App\Http\Controllers\Api\JobCardController as ApiJobCardController;
use App\Http\Controllers\EngineerCallController;

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    Route::get('/engineer/atms', [EngineerAtmController::class, 'index']);

    // Maintenance PMs
    Route::get('/maintenance', [\App\Http\Controllers\Api\MaintenanceController::class, 'index']);

    // Job Cards
    Route::apiResource('engineer/job-cards', ApiJobCardController::class)->except(['create', 'edit']);
    Route::post('/engineer/job-cards/{jobCard}/photos', [ApiJobCardController::class, 'uploadPhotos']);
    Route::post('/engineer/job-cards/{jobCard}/submit', [ApiJobCardController::class, 'submit']);

    // Calls (reusing EngineerCallController endpoints with json response)
    Route::get('/engineer/calls', [EngineerCallController::class, 'index']);
    Route::post('/engineer/calls/{call}/close', [EngineerCallController::class, 'close']);
    Route::post('/engineer/calls/{call}/note', [EngineerCallController::class, 'saveNote']);
    Route::post('/engineer/calls/{call}/assign', [EngineerCallController::class, 'assign']);
    Route::post('/engineer/calls/{call}/return', [EngineerCallController::class, 'returnCall']);
});
