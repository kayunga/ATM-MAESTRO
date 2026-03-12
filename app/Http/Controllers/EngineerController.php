<?php

namespace App\Http\Controllers;

use App\Models\Engineer;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;

class EngineerController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'name'   => 'required|string|max:120',
            'phone'  => 'nullable|string|max:30',
            'email'  => 'nullable|email|max:120',
            'region' => 'required|string|max:80',
        ]);

        Engineer::create($request->only(['name','phone','email','region']));

        return redirect()->back();
    }

    public function update(Request $request, Engineer $engineer): RedirectResponse
    {
        $request->validate([
            'name'   => 'required|string|max:120',
            'phone'  => 'nullable|string|max:30',
            'email'  => 'nullable|email|max:120',
            'region' => 'required|string|max:80',
        ]);

        $engineer->update($request->only(['name','phone','email','region']));

        return redirect()->back();
    }

    public function destroy(Engineer $engineer): RedirectResponse
    {
        $engineer->delete();

        return redirect()->back();
    }
}
