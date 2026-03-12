<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AtmFleetController;
use App\Http\Controllers\AtmController;
use App\Http\Controllers\BankController;
use App\Http\Controllers\EngineerController;
use App\Http\Controllers\MaintenanceController;

// ── Main SPA entry point ──────────────────────────────────────────────────────
// This is the only GET route — Inertia renders the React app with all data.
// Route::get('/', [AtmFleetController::class, 'index'])->name('index');
Route::get('/', [AtmFleetController::class, 'index'])->name('atm.fleet');

// ── Banks ─────────────────────────────────────────────────────────────────────
Route::post('/banks',           [BankController::class, 'store']);
Route::put('/banks/{bank}',     [BankController::class, 'update']);
Route::delete('/banks/{bank}',  [BankController::class, 'destroy']);

// ── ATMs ──────────────────────────────────────────────────────────────────────
Route::post('/atms',                [AtmController::class, 'store']);
Route::put('/atms/{atm}',          [AtmController::class, 'update']);
Route::delete('/atms/{atm}',       [AtmController::class, 'destroy']);
// Bulk operations — must be defined BEFORE the {atm} param route
Route::post('/atms/bulk-status',   [AtmController::class, 'bulkStatus']);
Route::post('/atms/bulk-reassign', [AtmController::class, 'bulkReassign']);
Route::post('/atms/bulk-delete',   [AtmController::class, 'bulkDelete']);

// ── Maintenance ───────────────────────────────────────────────────────────────
Route::post('/maintenance/bulk',            [MaintenanceController::class, 'bulkStore']);  // before {maintenance}
Route::post('/maintenance',                 [MaintenanceController::class, 'store']);
Route::put('/maintenance/{maintenance}',    [MaintenanceController::class, 'update']);
Route::delete('/maintenance/{maintenance}', [MaintenanceController::class, 'destroy']);

// ── Engineers ─────────────────────────────────────────────────────────────────
Route::post('/engineers',               [EngineerController::class, 'store']);
Route::put('/engineers/{engineer}',     [EngineerController::class, 'update']);
Route::delete('/engineers/{engineer}',  [EngineerController::class, 'destroy']);
