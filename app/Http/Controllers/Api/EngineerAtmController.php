<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Engineer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EngineerAtmController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $engineer = Engineer::where('user_id', $request->user()->id)
            ->with(['atms.bank'])
            ->firstOrFail();

        $atms = $engineer->atms->map(fn($atm) => [
            'id'            => $atm->id,
            'terminal_id'   => $atm->terminal_id,
            'serial_number' => $atm->serial_number,
            'model'         => $atm->model,
            'location'      => $atm->location,
            'address'       => $atm->address,
            'status'        => $atm->status,
            'install_date'  => $atm->install_date?->format('Y-m-d'),
            'bank' => [
                'id'         => $atm->bank->id,
                'name'       => $atm->bank->name,
                'short_code' => $atm->bank->short_code,
            ],
        ]);

        return response()->json($atms);
    }
}
