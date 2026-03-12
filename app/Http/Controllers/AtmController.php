<?php

namespace App\Http\Controllers;

use App\Models\Atm;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\Rule;

class AtmController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'terminal_id'   => 'required|string|max:50|unique:atms,terminal_id',
            'serial_number' => 'nullable|string|max:100|unique:atms,serial_number',
            'model'         => 'required|string|max:80',
            'location'      => 'required|string|max:150',
            'address'       => 'nullable|string|max:255',
            'bank_id'       => 'nullable|exists:banks,id',
            'engineer_id'   => 'required|exists:engineers,id',
            'status'        => ['required', Rule::in(['Active','Offline','Under Maintenance','Decommissioned'])],
            'install_date'  => 'nullable|date',
            'notes'         => 'nullable|string',
        ]);

        Atm::create($validated);

        return redirect()->back();
    }

    public function update(Request $request, Atm $atm): RedirectResponse
    {
        $validated = $request->validate([
            'terminal_id'   => ['required','string','max:50', Rule::unique('atms')->ignore($atm->id)],
            'serial_number' => ['nullable','string','max:100', Rule::unique('atms')->ignore($atm->id)],
            'model'         => 'required|string|max:80',
            'location'      => 'required|string|max:150',
            'address'       => 'nullable|string|max:255',
            'bank_id'       => 'nullable|exists:banks,id',
            'engineer_id'   => 'required|exists:engineers,id',
            'status'        => ['required', Rule::in(['Active','Offline','Under Maintenance','Decommissioned'])],
            'install_date'  => 'nullable|date',
            'notes'         => 'nullable|string',
        ]);

        $atm->update($validated);

        return redirect()->back();
    }

    public function destroy(Atm $atm): RedirectResponse
    {
        $atm->delete();

        return redirect()->back();
    }

    // ── Bulk operations ───────────────────────────────────────────────────────

    /**
     * POST /atms/bulk-status
     * Update status for multiple ATMs at once.
     */
    public function bulkStatus(Request $request): RedirectResponse
    {
        $request->validate([
            'ids'    => 'required|array|min:1',
            'ids.*'  => 'exists:atms,id',
            'status' => ['required', Rule::in(['Active','Offline','Under Maintenance','Decommissioned'])],
        ]);

        Atm::whereIn('id', $request->ids)->update(['status' => $request->status]);

        return redirect()->back();
    }

    /**
     * POST /atms/bulk-reassign
     * Reassign engineer for multiple ATMs at once.
     */
    public function bulkReassign(Request $request): RedirectResponse
    {
        $request->validate([
            'ids'         => 'required|array|min:1',
            'ids.*'       => 'exists:atms,id',
            'engineer_id' => 'required|exists:engineers,id',
        ]);

        Atm::whereIn('id', $request->ids)->update(['engineer_id' => $request->engineer_id]);

        return redirect()->back();
    }

    /**
     * POST /atms/bulk-delete
     * Soft-delete multiple ATMs (and their maintenance records via model events).
     */
    public function bulkDelete(Request $request): RedirectResponse
    {
        $request->validate([
            'ids'   => 'required|array|min:1',
            'ids.*' => 'exists:atms,id',
        ]);

        Atm::whereIn('id', $request->ids)->each(fn ($atm) => $atm->delete());

        return redirect()->back();
    }
}
