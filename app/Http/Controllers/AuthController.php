<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Engineer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Engineer login — returns a Sanctum token.
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        if (!Auth::attempt($request->only('email', 'password'))) {
            throw ValidationException::withMessages([
                'email' => ['Invalid credentials. Please check your email and password.'],
            ]);
        }

        $user     = $request->user();
        $engineer = Engineer::where('user_id', $user->id)->first();

        if (!$engineer) {
            // User exists but has no engineer profile
            return response()->json([
                'message' => 'Your account is not linked to an engineer profile. Contact your administrator.',
            ], 403);
        }

        // Revoke existing tokens to prevent token accumulation
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

    /**
     * Return the authenticated engineer's profile.
     */
    public function me(Request $request): JsonResponse
    {
        $user     = $request->user();
        $engineer = Engineer::where('user_id', $user->id)
            ->with(['atms.bank'])
            ->firstOrFail();

        return response()->json([
            'id'     => $engineer->id,
            'name'   => $engineer->name,
            'email'  => $user->email,
            'phone'  => $engineer->phone,
            'region' => $engineer->region,
            'atm_count' => $engineer->atms->count(),
        ]);
    }

    /**
     * Revoke the current token (logout).
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out successfully.']);
    }
}
