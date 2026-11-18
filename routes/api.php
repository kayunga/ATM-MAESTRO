<?php

// routes/api.php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\EngineerAtmController;
use App\Http\Controllers\Api\JobCardController as ApiJobCardController;
/*
|--------------------------------------------------------------------------
| NCR ATM Fleet Manager — API Routes
|--------------------------------------------------------------------------
|
| All routes are prefixed with /api (configured in bootstrap/app.php)
| and return JSON responses.
|
*/

use App\Http\Controllers\Api\MaintenanceController as ApiMaintenanceController;
use App\Http\Controllers\AtmController;
use App\Http\Controllers\EngineerCallController;
use App\Http\Controllers\EngineerController;
use App\Http\Controllers\JobCardDownloadController;
use Illuminate\Support\Facades\Route;

// Legacy fleet endpoints are restricted to authenticated administrators.
Route::middleware(['auth:sanctum', 'admin'])->group(function () {
    Route::get('/stats', [AtmController::class, 'stats']);
    Route::apiResource('atms', AtmController::class);
    Route::apiResource('engineers', EngineerController::class);
});

// Keep the original engineer endpoints available while mobile clients migrate.
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:6,1');
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/engineer/atms', [EngineerAtmController::class, 'index']);
    Route::get('/maintenance', [ApiMaintenanceController::class, 'index']);
    Route::apiResource('engineer/job-cards', ApiJobCardController::class)->except(['create', 'edit']);
    Route::post('/engineer/job-cards/{jobCard}/photos', [ApiJobCardController::class, 'uploadPhotos']);
    Route::post('/engineer/job-cards/{jobCard}/submit', [ApiJobCardController::class, 'submit']);
    Route::get('/engineer/calls', [EngineerCallController::class, 'index']);
    Route::post('/engineer/calls/{call}/close', [EngineerCallController::class, 'close']);
    Route::post('/engineer/calls/{call}/note', [EngineerCallController::class, 'saveNote']);
    Route::post('/engineer/calls/{call}/assign', [EngineerCallController::class, 'assign']);
    Route::post('/engineer/calls/{call}/return', [EngineerCallController::class, 'returnCall']);
});

// Versioned mobile engineer API. The old paths above remain compatibility aliases.
Route::prefix('v1')->name('api.v1.')->group(function () {
    Route::post('/auth/login', [AuthController::class, 'login'])
        ->middleware('throttle:6,1')
        ->name('auth.login');

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/auth/logout', [AuthController::class, 'logout'])->name('auth.logout');
        Route::get('/me', [AuthController::class, 'me'])->name('me');
        Route::put('/me/signature', [AuthController::class, 'updateSignature'])->name('me.signature.update');
        Route::put('/me/password', [AuthController::class, 'updatePassword'])->name('me.password.update');

        Route::get('/engineer/atms', [EngineerAtmController::class, 'index'])->name('engineer.atms.index');
        Route::get('/maintenance', [ApiMaintenanceController::class, 'index'])->name('maintenance.index');

        Route::apiResource('engineer/job-cards', ApiJobCardController::class)
            ->except(['create', 'edit'])
            ->names('engineer.job-cards');
        Route::post('/engineer/job-cards/{jobCard}/photos', [ApiJobCardController::class, 'uploadPhotos'])
            ->name('engineer.job-cards.photos');
        Route::post('/engineer/job-cards/{jobCard}/submit', [ApiJobCardController::class, 'submit'])
            ->name('engineer.job-cards.submit');
        Route::get('/engineer/job-cards/{jobCard}/print', [JobCardDownloadController::class, 'printCard'])
            ->name('engineer.job-cards.print');

        Route::get('/engineer/calls', [EngineerCallController::class, 'index'])->name('engineer.calls.index');
        Route::post('/engineer/calls/{call}/close', [EngineerCallController::class, 'close'])->name('engineer.calls.close');
        Route::post('/engineer/calls/{call}/note', [EngineerCallController::class, 'saveNote'])->name('engineer.calls.note');
        Route::post('/engineer/calls/{call}/assign', [EngineerCallController::class, 'assign'])->name('engineer.calls.assign');
        Route::post('/engineer/calls/{call}/return', [EngineerCallController::class, 'returnCall'])->name('engineer.calls.return');
    });
});
