<?php

namespace App\Http\Controllers;

use App\Models\Atm;
use App\Models\Bank;
use App\Models\Engineer;
use App\Models\MaintenanceRecord;
use Inertia\Inertia;
use Inertia\Response;

class AtmFleetController extends Controller
{
    /**
     * GET /atm-fleet
     * Renders the React SPA and injects all data as Inertia props.
     */
    public function index(): Response
    {
        return Inertia::render('ATMFleetManager', [
            'atms' => Atm::with(['bank', 'engineer'])
                ->orderBy('terminal_id')
                ->get(),

            'banks' => Bank::withCount([
                    'atms',
                    'atms as active_atms_count'  => fn ($q) => $q->where('status', 'Active'),
                    'atms as offline_atms_count' => fn ($q) => $q->where('status', 'Offline'),
                    'atms as maint_atms_count'   => fn ($q) => $q->where('status', 'Under Maintenance'),
                ])
                ->orderBy('name')
                ->get(),

            'engineers' => Engineer::orderBy('name')->get(),

            'maintenance' => MaintenanceRecord::with(['atm', 'engineer'])
                ->orderByDesc('scheduled_date')
                ->get(),
        ]);
    }
}
