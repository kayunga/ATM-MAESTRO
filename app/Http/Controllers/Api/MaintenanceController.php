<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MaintenanceRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MaintenanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = MaintenanceRecord::with(['atm.bank']);

        if ($request->has('atm_id')) {
            $query->where('atm_id', $request->query('atm_id'));
        }
        if ($request->has('status')) {
            $query->where('status', $request->query('status'));
        }
        if ($request->has('type')) {
            $query->where('type', $request->query('type'));
        }
        if ($request->has('quarter')) {
            $query->where('quarter', $request->query('quarter'));
        }
        if ($request->has('year')) {
            $query->where('year', $request->query('year'));
        }

        // Only return records assigned to the current engineer, unless admin
        if ($request->user() && !$request->user()->is_admin) {
            $engineer = \App\Models\Engineer::where('user_id', $request->user()->id)->first();
            if ($engineer) {
                $query->where('engineer_id', $engineer->id);
            }
        }

        $records = $query->orderBy('scheduled_date', 'asc')->get()->map(function ($record) {
            return [
                'id' => $record->id,
                'atm_id' => $record->atm_id,
                'type' => $record->type,
                'status' => $record->status,
                'scheduled_date' => $record->scheduled_date?->format('Y-m-d'),
                'completed_date' => $record->completed_date?->format('Y-m-d'),
                'quarter' => $record->quarter,
                'year' => $record->year,
                'notes' => $record->notes,
                'atm' => $record->atm ? [
                    'terminal_id' => $record->atm->terminal_id,
                    'location' => $record->atm->location,
                    'model' => $record->atm->model,
                    'bank' => $record->atm->bank ? [
                        'short_code' => $record->atm->bank->short_code
                    ] : null,
                ] : null,
            ];
        });

        return response()->json($records);
    }
}
