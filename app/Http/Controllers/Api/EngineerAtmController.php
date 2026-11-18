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
        $filters = $request->validate([
            'search' => ['sometimes', 'nullable', 'string', 'max:120'],
            'status' => ['sometimes', 'nullable', 'string', 'max:40'],
            'per_page' => ['sometimes', 'integer', 'between:1,100'],
        ]);
        $engineer = Engineer::where('user_id', $request->user()->id)
            ->firstOrFail();

        $query = $engineer->atms()->with('bank')
            ->when(!empty($filters['status']), fn($query) => $query->where('status', $filters['status']))
            ->when(!empty($filters['search']), function ($query) use ($filters): void {
                $search = trim($filters['search']);
                $query->where(function ($matches) use ($search): void {
                    $matches->where('terminal_id', 'like', "%{$search}%")
                        ->orWhere('location', 'like', "%{$search}%")
                        ->orWhere('serial_number', 'like', "%{$search}%")
                        ->orWhereHas('bank', fn($bank) => $bank->where('name', 'like', "%{$search}%")
                            ->orWhere('short_code', 'like', "%{$search}%"));
                });
            })
            ->orderBy('terminal_id');

        $formatAtm = fn($atm) => [
            'id'            => $atm->id,
            'terminal_id'   => $atm->terminal_id,
            'serial_number' => $atm->serial_number,
            'model'         => $atm->model,
            'location'      => $atm->location,
            'address'       => $atm->address,
            'status'        => $atm->status,
            'has_gbna'      => (bool) $atm->has_gbna,
            'install_date'  => $atm->install_date?->format('Y-m-d'),
            'bank' => [
                'id'         => $atm->bank->id,
                'name'       => $atm->bank->name,
                'short_code' => $atm->bank->short_code,
            ],
        ];

        if ($request->is('api/v1/*')) {
            return response()->json(
                $query->paginate($filters['per_page'] ?? 25)->through($formatAtm)
            );
        }

        return response()->json($query->get()->map($formatAtm));
    }
}
