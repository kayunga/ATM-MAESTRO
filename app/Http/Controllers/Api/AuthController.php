<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Engineer;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
            'device_name' => ['sometimes', 'nullable', 'string', 'max:100'],
        ]);

        $user = User::whereRaw('LOWER(email) = ?', [Str::lower($credentials['email'])])->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Invalid credentials.'],
            ]);
        }

        $engineer = Engineer::where('user_id', $user->id)->first();

        if (! $engineer) {
            return response()->json(['message' => 'No engineer profile linked to this account.'], 403);
        }

        $deviceName = trim($request->input('device_name', 'engineer-app')) ?: 'engineer-app';
        $token = $user->createToken($deviceName)->plainTextToken;

        return response()->json([
            'token' => $token,
            'token_type' => 'Bearer',
            'engineer' => [
                'id' => $engineer->id,
                'name' => $engineer->name,
                'email' => $user->email,
                'phone' => $engineer->phone,
                'region' => $engineer->region,
                'signature' => $engineer->signature,
            ],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $engineer = Engineer::where('user_id', $user->id)->with(['atms.bank'])->firstOrFail();

        return response()->json([
            'id' => $engineer->id,
            'name' => $engineer->name,
            'email' => $user->email,
            'phone' => $engineer->phone,
            'region' => $engineer->region,
            'signature' => $engineer->signature,
            'is_admin' => $user->is_admin,
            'atm_count' => $engineer->atms->count(),
        ]);
    }

    public function updateSignature(Request $request): JsonResponse
    {
        $data = $request->validate([
            'signature' => ['nullable', 'string', 'max:500000', 'regex:/\Adata:image\/(?:png|jpeg);base64,[A-Za-z0-9+\/]+=*\z/'],
        ]);
        $engineer = Engineer::where('user_id', $request->user()->id)->firstOrFail();
        $engineer->update(['signature' => $data['signature'] ?? null]);

        return response()->json(['signature' => $engineer->signature]);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'current_password:sanctum'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);
        $request->user()->forceFill(['password' => Hash::make($data['password'])])->save();

        return response()->json(['message' => 'Password updated.']);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => 'Logged out.']);
    }
}
