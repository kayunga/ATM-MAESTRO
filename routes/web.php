<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AtmFleetController;
use App\Http\Controllers\AtmController;
use App\Http\Controllers\BankController;
use App\Http\Controllers\EngineerController;
use App\Http\Controllers\MaintenanceController;
use App\Http\Controllers\EngineerPortalController;
use App\Http\Controllers\JobCardDownloadController;
use App\Http\Controllers\Api\JobCardController;

// ── Auth ──────────────────────────────────────────────────────────────────────
// One login page for everyone. After login, the controller decides where to send
// the user based on whether they have an admin role or an engineer profile.
Route::middleware('guest')->group(function () {
    Route::get ('/login', fn() => inertia('auth/login'))->name('login');
    Route::post('/login', [EngineerPortalController::class, 'login'])->name('login.store');
});
Route::middleware('auth')->post('/logout', [EngineerPortalController::class, 'logout'])->name('logout');

// ── Admin SPA ─────────────────────────────────────────────────────────────────
Route::middleware(['auth', 'admin'])->group(function () {
    Route::get('/', [AtmFleetController::class, 'index'])->name('atm.fleet');

    Route::post('/banks',          [BankController::class, 'store']);
    Route::put('/banks/{bank}',    [BankController::class, 'update']);
    Route::delete('/banks/{bank}', [BankController::class, 'destroy']);

    Route::post('/atms/bulk-status',   [AtmController::class, 'bulkStatus']);
    Route::post('/atms/bulk-reassign', [AtmController::class, 'bulkReassign']);
    Route::post('/atms/bulk-delete',   [AtmController::class, 'bulkDelete']);
    Route::post('/atms',               [AtmController::class, 'store']);
    Route::put('/atms/{atm}',          [AtmController::class, 'update']);
    Route::delete('/atms/{atm}',       [AtmController::class, 'destroy']);

    Route::post('/maintenance/bulk',            [MaintenanceController::class, 'bulkStore']);
    Route::post('/maintenance',                 [MaintenanceController::class, 'store']);
    Route::put('/maintenance/{maintenance}',    [MaintenanceController::class, 'update']);
    Route::delete('/maintenance/{maintenance}', [MaintenanceController::class, 'destroy']);

    Route::post('/engineers',              [EngineerController::class, 'store']);
    Route::put('/engineers/{engineer}',    [EngineerController::class, 'update']);
    Route::delete('/engineers/{engineer}', [EngineerController::class, 'destroy']);

    Route::get ('/job-cards/data',               [JobCardController::class, 'adminIndex']);
    Route::post('/job-cards/{jobCard}/approve',  [JobCardController::class, 'approve']);
    Route::post('/job-cards/{jobCard}/reject',   [JobCardController::class, 'reject']);
    Route::post('/job-cards/bulk-download',      [JobCardDownloadController::class, 'bulk'])->name('job-cards.bulk-download');
});

// ── Calls (admin CRUD) ───────────────────────────────────────────────────────
Route::middleware(['auth', 'admin'])->group(function () {
    Route::get ('/calls',        [\App\Http\Controllers\CallController::class, 'index'])->name('calls.index');
    Route::post('/calls',        [\App\Http\Controllers\CallController::class, 'store'])->name('calls.store');
    Route::put ('/calls/{call}', [\App\Http\Controllers\CallController::class, 'update'])->name('calls.update');
    Route::delete('/calls/{call}', [\App\Http\Controllers\CallController::class, 'destroy'])->name('calls.destroy');
});

// ── Calls (engineer portal) ───────────────────────────────────────────────────
Route::middleware('auth')->group(function () {
    Route::get ('/engineer/calls',                  [\App\Http\Controllers\EngineerCallController::class, 'index'])->name('engineer.calls.index');
    Route::post('/engineer/calls/{call}/assign',    [\App\Http\Controllers\EngineerCallController::class, 'assign'])->name('engineer.calls.assign');
    Route::post('/engineer/calls/{call}/return',    [\App\Http\Controllers\EngineerCallController::class, 'returnCall'])->name('engineer.calls.return');
    Route::post('/engineer/calls/{call}/note',      [\App\Http\Controllers\EngineerCallController::class, 'saveNote'])->name('engineer.calls.note');
    Route::post('/engineer/calls/{call}/close',     [\App\Http\Controllers\EngineerCallController::class, 'close'])->name('engineer.calls.close');
});

// ── Shared download route (admin + elevated engineers) ────────────────────────
Route::middleware('auth')->get(
    '/job-cards/{jobCard}/files/{index}',
    [JobCardDownloadController::class, 'singleFile']
)->name('job-cards.file');

// ── Engineer Portal ───────────────────────────────────────────────────────────
Route::middleware('auth')->group(function () {
    Route::get('/engineer', [EngineerPortalController::class, 'index'])->name('engineer.portal');
    Route::post('/engineer/job-cards',                  [EngineerPortalController::class, 'storeJobCard'])->name('engineer.job-cards.store');
    Route::post('/engineer/job-cards/{jobCard}/submit', [EngineerPortalController::class, 'submitJobCard'])->name('engineer.job-cards.submit');
    Route::delete('/engineer/job-cards/{jobCard}',      [EngineerPortalController::class, 'destroyJobCard'])->name('engineer.job-cards.destroy');
});
