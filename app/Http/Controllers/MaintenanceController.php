<?php

namespace App\Http\Controllers;

use App\Models\MaintenanceRecord;
use Illuminate\Http\Request;
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
        $request->validate([
            'records'                  => 'required|array',
            'records.*.atm_id'         => 'required|exists:atms,id',
            'records.*.engineer_id'    => 'nullable|exists:engineers,id',
            'records.*.type'           => 'required|string',
            'records.*.status'         => 'required|string',
            'records.*.scheduled_date' => 'required|date',
            'records.*.completed_date' => 'nullable|date',
            'records.*.quarter'        => 'required|integer|between:1,4',
            'records.*.year'           => 'required|integer|min:2000|max:2099',
            'records.*.notes'          => 'nullable|string',
        ]);

        foreach ($request->records as $record) {
            MaintenanceRecord::create($record);
        }

        return redirect()->back();
    }
}
