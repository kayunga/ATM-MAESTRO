<?php

namespace App\Http\Controllers;

use App\Models\Bank;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\Rule;

class BankController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'name'           => 'required|string|max:120',
            'short_code'     => 'required|string|max:10|unique:banks,short_code',
            'contact_person' => 'nullable|string|max:120',
            'contact_phone'  => 'nullable|string|max:30',
            'contact_email'  => 'nullable|email|max:120',
            'headquarters'   => 'nullable|string|max:255',
            'notes'          => 'nullable|string',
        ]);

        Bank::create($request->only([
            'name','short_code','contact_person','contact_phone',
            'contact_email','headquarters','notes',
        ]));

        return redirect()->back();
    }

    public function update(Request $request, Bank $bank): RedirectResponse
    {
        $request->validate([
            'name'           => 'required|string|max:120',
            'short_code'     => ['required','string','max:10', Rule::unique('banks')->ignore($bank->id)],
            'contact_person' => 'nullable|string|max:120',
            'contact_phone'  => 'nullable|string|max:30',
            'contact_email'  => 'nullable|email|max:120',
            'headquarters'   => 'nullable|string|max:255',
            'notes'          => 'nullable|string',
        ]);

        $bank->update($request->only([
            'name','short_code','contact_person','contact_phone',
            'contact_email','headquarters','notes',
        ]));

        return redirect()->back();
    }

    public function destroy(Bank $bank): RedirectResponse
    {
        $bank->delete();
        return redirect()->back();
    }
}
