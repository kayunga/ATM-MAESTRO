<?php

namespace App\Http\Controllers;

use App\Models\MaintenanceRecord;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class MaintenanceController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'atm_id'         => 'required|exists:atms,id',
            'engineer_id'    => 'nullable|exists:engineers,id',
            'type'           => ['required', Rule::in(['Quarterly PM','Emergency','Part Replacement','Software Update','Cash Jam','Card Reader Service'])],
            'status'         => ['required', Rule::in(['Scheduled','In Progress','Completed','Cancelled'])],
            'scheduled_date' => 'required|date',
            'completed_date' => 'nullable|date',
            'quarter'        => 'required|integer|between:1,4',
            'year'           => 'required|integer|min:2000|max:2099',
            'notes'          => 'nullable|string',
        ]);

        MaintenanceRecord::create($validated);

        return redirect()->back();
    }

    public function update(Request $request, MaintenanceRecord $maintenance)
    {
        $validated = $request->validate([
            'atm_id'         => 'required|exists:atms,id',
            'engineer_id'    => 'nullable|exists:engineers,id',
            'type'           => ['required', Rule::in(['Quarterly PM','Emergency','Part Replacement','Software Update','Cash Jam','Card Reader Service'])],
            'status'         => ['required', Rule::in(['Scheduled','In Progress','Completed','Cancelled'])],
            'scheduled_date' => 'required|date',
            'completed_date' => 'nullable|date',
            'quarter'        => 'required|integer|between:1,4',
            'year'           => 'required|integer|min:2000|max:2099',
            'notes'          => 'nullable|string',
        ]);

        $maintenance->update($validated);

        return redirect()->back();
    }

    public function destroy(MaintenanceRecord $maintenance)
    {
        $maintenance->delete();
        return redirect()->back();
    }

    public function bulkStore(Request $request)
    {
        $records = $request->validate([
            'records'                  => 'required|array',
            'records.*.atm_id'         => 'required|exists:atms,id',
            'records.*.engineer_id'    => 'nullable|exists:engineers,id',
            'records.*.type'           => ['required', Rule::in(['Quarterly PM','Emergency','Part Replacement','Software Update','Cash Jam','Card Reader Service'])],
            'records.*.status'         => ['required', Rule::in(['Scheduled','In Progress','Completed','Cancelled'])],
            'records.*.scheduled_date' => 'required|date',
            'records.*.completed_date' => 'nullable|date',
            'records.*.quarter'        => 'required|integer|between:1,4',
            'records.*.year'           => 'required|integer|min:2000|max:2099',
            'records.*.notes'          => 'nullable|string',
        ]);

        DB::transaction(function () use ($records): void {
            foreach ($records['records'] as $record) {
                $matchingRecords = MaintenanceRecord::query()
                    ->where('atm_id', $record['atm_id'])
                    ->where('type', $record['type'])
                    ->where('quarter', $record['quarter'])
                    ->where('year', $record['year']);

                if ($record['status'] !== 'Cancelled') {
                    $matchingRecords->where('status', '!=', 'Cancelled');
                }

                if ($matchingRecords->exists()) {
                    $completedDate = $record['status'] === 'Completed'
                        ? ($record['completed_date'] ?? $record['scheduled_date'])
                        : null;

                    $updates = [
                        'engineer_id' => $record['engineer_id'] ?? null,
                        'status' => $record['status'],
                        'completed_date' => $completedDate,
                        'notes' => $record['notes'] ?? null,
                    ];

                    if ($record['status'] !== 'Completed') {
                        $updates['scheduled_date'] = $record['scheduled_date'];
                    }

                    $matchingRecords->update($updates);

                    continue;
                }

                if ($record['status'] === 'Completed' && empty($record['completed_date'])) {
                    $record['completed_date'] = $record['scheduled_date'];
                }

                MaintenanceRecord::create($record);
            }
        });

        return redirect()->back();
    }
}
