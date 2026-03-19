<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Engineer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        if (!Auth::attempt($request->only('email', 'password'))) {
            throw ValidationException::withMessages([
                'email' => ['Invalid credentials.'],
            ]);
        }

        $user     = $request->user();
        $engineer = Engineer::where('user_id', $user->id)->first();

        if (!$engineer) {
            return response()->json(['message' => 'No engineer profile linked to this account.'], 403);
        }

        $user->tokens()->delete();
        $token = $user->createToken('engineer-app')->plainTextToken;

        return response()->json([
            'token'    => $token,
            'engineer' => [
                'id'     => $engineer->id,
                'name'   => $engineer->name,
                'email'  => $user->email,
                'phone'  => $engineer->phone,
                'region' => $engineer->region,
            ],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user     = $request->user();
        $engineer = Engineer::where('user_id', $user->id)->with(['atms.bank'])->firstOrFail();

        return response()->json([
            'id'        => $engineer->id,
            'name'      => $engineer->name,
            'email'     => $user->email,
            'phone'     => $engineer->phone,
            'region'    => $engineer->region,
            'atm_count' => $engineer->atms->count(),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out.']);
    }
}
