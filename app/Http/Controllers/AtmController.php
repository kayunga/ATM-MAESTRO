<?php

namespace App\Http\Controllers;

use App\Models\Atm;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AtmController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'terminal_id'   => 'required|string|unique:atms,terminal_id',
            'serial_number' => 'nullable|string',
            'model'         => 'required|string',
            'location'      => 'required|string',
            'address'       => 'nullable|string',
            'bank_id'       => 'required|exists:banks,id',
            'engineer_id'   => 'nullable|exists:engineers,id',
            'status'        => ['required', Rule::in(['Active','Offline','Under Maintenance','Decommissioned'])],
            'install_date'  => 'nullable|date',
            'notes'         => 'nullable|string',
        ]);

        Atm::create($validated);
        return redirect()->back();
    }

    public function update(Request $request, Atm $atm)
    {
        $validated = $request->validate([
            'terminal_id'   => ['required','string', Rule::unique('atms','terminal_id')->ignore($atm->id)],
            'serial_number' => 'nullable|string',
            'model'         => 'required|string',
            'location'      => 'required|string',
            'address'       => 'nullable|string',
            'bank_id'       => 'required|exists:banks,id',
            'engineer_id'   => 'nullable|exists:engineers,id',
            'status'        => ['required', Rule::in(['Active','Offline','Under Maintenance','Decommissioned'])],
            'install_date'  => 'nullable|date',
            'notes'         => 'nullable|string',
        ]);

        $atm->update($validated);
        return redirect()->back();
    }

    public function destroy(Atm $atm)
    {
        $atm->delete();
        return redirect()->back();
    }

    public function bulkStatus(Request $request)
    {
        $request->validate([
            'ids'    => 'required|array',
            'ids.*'  => 'exists:atms,id',
            'status' => ['required', Rule::in(['Active','Offline','Under Maintenance','Decommissioned'])],
        ]);

        Atm::whereIn('id', $request->ids)->update(['status' => $request->status]);
        return redirect()->back();
    }

    public function bulkReassign(Request $request)
    {
        $request->validate([
            'ids'         => 'required|array',
            'ids.*'       => 'exists:atms,id',
            'engineer_id' => 'required|exists:engineers,id',
        ]);

        Atm::whereIn('id', $request->ids)->update(['engineer_id' => $request->engineer_id]);
        return redirect()->back();
    }

    public function bulkDelete(Request $request)
    {
        $request->validate([
            'ids'   => 'required|array',
            'ids.*' => 'exists:atms,id',
        ]);

        Atm::whereIn('id', $request->ids)->delete();
        return redirect()->back();
    }
}
