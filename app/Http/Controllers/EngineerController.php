<?php

namespace App\Http\Controllers;

use App\Models\Engineer;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class EngineerController extends Controller
{
    public function store(Request $request)
    {
        $rules = [
            'name'   => 'required|string|max:255',
            'phone'  => 'nullable|string|max:50',
            'email'  => 'nullable|email|max:255',
            'region' => 'required|string|max:255',
        ];

        if ($request->boolean('create_login')) {
            $rules['email']                 = 'required|email|max:255|unique:users,email';
            $rules['password']              = 'required|string|min:8|confirmed';
            $rules['password_confirmation'] = 'required|string';
        }

        $validated = $request->validate($rules);

        DB::transaction(function () use ($request, $validated) {
            $engineer = Engineer::create([
                'name'   => $validated['name'],
                'phone'  => $validated['phone']  ?? null,
                'email'  => $validated['email']  ?? null,
                'region' => $validated['region'],
            ]);

            if ($request->boolean('create_login')) {
                $user = User::create([
                    'name'     => $validated['name'],
                    'email'    => $validated['email'],
                    'password' => Hash::make($validated['password']),
                ]);
                $engineer->update(['user_id' => $user->id]);
            }
        });

        return redirect()->back();
    }

    public function update(Request $request, Engineer $engineer)
    {
        $rules = [
            'name'   => 'required|string|max:255',
            'phone'  => 'nullable|string|max:50',
            'email'  => 'nullable|email|max:255',
            'region' => 'required|string|max:255',
        ];

        if ($request->boolean('create_login')) {
            $rules['email']                 = 'required|email|max:255|unique:users,email';
            $rules['password']              = 'required|string|min:8|confirmed';
            $rules['password_confirmation'] = 'required|string';
        }

        $validated = $request->validate($rules);

        DB::transaction(function () use ($request, $validated, $engineer) {
            $engineer->update([
                'name'   => $validated['name'],
                'phone'  => $validated['phone']  ?? null,
                'email'  => $validated['email']  ?? null,
                'region' => $validated['region'],
            ]);

            if ($request->boolean('revoke_login') && $engineer->user_id) {
                User::find($engineer->user_id)?->delete();
                $engineer->update(['user_id' => null]);
            } elseif ($request->boolean('create_login') && !$engineer->user_id) {
                $user = User::create([
                    'name'     => $validated['name'],
                    'email'    => $validated['email'],
                    'password' => Hash::make($validated['password']),
                ]);
                $engineer->update(['user_id' => $user->id]);
            }
        });

        return redirect()->back();
    }

    public function destroy(Engineer $engineer)
    {
        DB::transaction(function () use ($engineer) {
            if ($engineer->user_id) {
                User::find($engineer->user_id)?->delete();
            }
            $engineer->delete();
        });

        return redirect()->back();
    }
}
