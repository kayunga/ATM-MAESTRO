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
Route::get('/maintenance/due', [MaintenanceController::class, 'due']);
// GET /api/maintenance/due?quarter=3&year=2024  → ATMs missing quarterly PM

Route::apiResource('maintenance', MaintenanceController::class);
// GET    /api/maintenance       → index  (supports ?atm_id=, ?status=, ?type=, ?quarter=, ?year=)
// POST   /api/maintenance       → store
// GET    /api/maintenance/{id}  → show
// PUT    /api/maintenance/{id}  → update
// DELETE /api/maintenance/{id}  → destroy

// ── Engineers ──────────────────────────────────────────────────────────────
Route::apiResource('engineers', EngineerController::class);
// GET    /api/engineers       → index  (supports ?region=)
// POST   /api/engineers       → store
// GET    /api/engineers/{id}  → show   (includes assigned ATMs)
// PUT    /api/engineers/{id}  → update
// DELETE /api/engineers/{id}  → destroy
