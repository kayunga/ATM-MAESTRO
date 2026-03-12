<?php

namespace App\Http\Controllers;

use App\Models\MaintenanceRecord;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\Rule;

class MaintenanceController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $request->validate($this->rules());

        MaintenanceRecord::create($request->only([
            'atm_id','engineer_id','type','status',
            'scheduled_date','completed_date','quarter','year','notes',
        ]));

        return redirect()->back();
    }

    public function update(Request $request, MaintenanceRecord $maintenance): RedirectResponse
    {
        $request->validate($this->rules());

        $maintenance->update($request->only([
            'atm_id','engineer_id','type','status',
            'scheduled_date','completed_date','quarter','year','notes',
        ]));

        return redirect()->back();
    }

    public function destroy(MaintenanceRecord $maintenance): RedirectResponse
    {
        $maintenance->delete();

        return redirect()->back();
    }

    /**
     * POST /maintenance/bulk
     * Log a maintenance record for multiple ATMs at once (Bulk PM Wizard).
     */
    public function bulkStore(Request $request): RedirectResponse
    {
        $request->validate([
            'records'                    => 'required|array|min:1',
            'records.*.atm_id'           => 'required|exists:atms,id',
            'records.*.engineer_id'      => 'required|exists:engineers,id',
            'records.*.type'             => 'required|string|max:80',
            'records.*.status'           => ['required', Rule::in(['Scheduled','In Progress','Completed','Cancelled'])],
            'records.*.scheduled_date'   => 'required|date',
            'records.*.completed_date'   => 'nullable|date',
            'records.*.quarter'          => 'required|integer|between:1,4',
            'records.*.year'             => 'required|integer|min:2000|max:2100',
            'records.*.notes'            => 'nullable|string',
        ]);

        foreach ($request->records as $record) {
            MaintenanceRecord::create($record);
        }

        return redirect()->back();
    }

    // ── Shared validation rules ───────────────────────────────────────────────
    private function rules(): array
    {
        return [
            'atm_id'         => 'required|exists:atms,id',
            'engineer_id'    => 'required|exists:engineers,id',
            'type'           => 'required|string|max:80',
            'status'         => ['required', Rule::in(['Scheduled','In Progress','Completed','Cancelled'])],
            'scheduled_date' => 'required|date',
            'completed_date' => 'nullable|date',
            'quarter'        => 'required|integer|between:1,4',
            'year'           => 'required|integer|min:2000|max:2100',
            'notes'          => 'nullable|string',
        ];
    }
}
