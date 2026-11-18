<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Engineer;
use App\Models\MaintenanceRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MaintenanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'atm_id' => ['sometimes', 'integer', 'exists:atms,id'],
            'status' => ['sometimes', 'nullable', 'string', 'max:40'],
            'type' => ['sometimes', 'nullable', 'string', 'max:100'],
            'quarter' => ['sometimes', 'integer', 'between:1,4'],
            'year' => ['sometimes', 'integer', 'min:2020', 'max:2100'],
            'per_page' => ['sometimes', 'integer', 'between:1,100'],
        ]);
        $query = MaintenanceRecord::with(['atm.bank']);

        $query->when(isset($filters['atm_id']), fn($query) => $query->where('atm_id', $filters['atm_id']))
            ->when(!empty($filters['status']), fn($query) => $query->where('status', $filters['status']))
            ->when(!empty($filters['type']), fn($query) => $query->where('type', $filters['type']))
            ->when(isset($filters['quarter']), fn($query) => $query->where('quarter', $filters['quarter']))
            ->when(isset($filters['year']), fn($query) => $query->where('year', $filters['year']));

        // Only return records assigned to the current engineer, unless admin
        if ($request->user() && !$request->user()->is_admin) {
            $engineer = Engineer::where('user_id', $request->user()->id)->firstOrFail();
            $query->where('engineer_id', $engineer->id);
        }

        $formatRecord = function ($record): array {
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
        };

        $query->orderBy('scheduled_date')->orderBy('id');
        if ($request->is('api/v1/*')) {
            return response()->json(
                $query->paginate($filters['per_page'] ?? 25)->through($formatRecord)
            );
        }

        return response()->json($query->get()->map($formatRecord));
    }
}
