<?php

namespace App\Http\Controllers;

use App\Models\Call;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class CallController extends Controller
{
    const SLA_HOURS = ['high' => 2, 'medium' => 3, 'low' => 5];

    public function index(Request $request): JsonResponse
    {
        $status   = $request->query('status', 'pending');
        $priority = $request->query('priority', 'all');

        // Update SLA and call type state before returning any call data.
        Call::whereNotIn('status', ['resolved'])
            ->whereNotNull('sla_breach_at')
            ->where('sla_breached', false)
            ->where('sla_breach_at', '<', now())
            ->update(['sla_breached' => true]);

        Call::whereNotIn('status', ['resolved'])
            ->where('call_type', 'new')
            ->whereDate('created_at', '<', now()->toDateString())
            ->update(['call_type' => 'old']);

        if ($request->boolean('summary')) {
            $summaryQuery = Call::query()
                ->when($priority !== 'all', fn ($query) => $query->where('priority', $priority));

            $countsByStatus = (clone $summaryQuery)
                ->selectRaw('status, COUNT(*) as aggregate')
                ->groupBy('status')
                ->pluck('aggregate', 'status');

            $slaBreached = (clone $summaryQuery)
                ->whereNotNull('sla_breach_at')
                ->where(function ($query) {
                    $query->where(function ($openCalls) {
                        $openCalls->where('status', '!=', 'resolved')
                            ->where('sla_breach_at', '<', now());
                    })->orWhere(function ($resolvedCalls) {
                        $resolvedCalls->where('status', 'resolved')
                            ->whereRaw('COALESCE(resolved_at, closed_at) > sla_breach_at');
                    });
                })
                ->count();

            return response()->json([
                'all' => (int) $countsByStatus->sum(),
                'pending' => (int) $countsByStatus->get('pending', 0),
                'assigned' => (int) $countsByStatus->get('assigned', 0),
                'on_hold' => (int) $countsByStatus->get('on_hold', 0),
                'closed' => (int) $countsByStatus->get('resolved', 0),
                'unresolved' => (int) $summaryQuery->where('status', '!=', 'resolved')->count(),
                'sla_breached' => $slaBreached,
            ]);
        }

        $dateFrom  = $request->query('date_from');
        $dateTo    = $request->query('date_to');
        $type      = $request->query('call_type', 'all');
        $engineerId= $request->query('engineer_id');
        $perPage = $request->has('per_page')
            ? $request->validate(['per_page' => ['required', 'integer', 'between:1,100']])['per_page']
            : null;

        $query = Call::query()
            ->when($status === 'closed',  fn($q) => $q->where('status', 'resolved'))
            ->when(!in_array($status, ['all', 'closed', 'unresolved', 'sla_breached'], true), fn($q) => $q->where('status', $status))
            ->when($status === 'unresolved', fn ($q) => $q->where('status', '!=', 'resolved'))
            ->when($status === 'sla_breached', function ($q) {
                $q->whereNotNull('sla_breach_at')
                    ->where(function ($breached) {
                        $breached->where(function ($openCalls) {
                            $openCalls->where('status', '!=', 'resolved')
                                ->where('sla_breach_at', '<', now());
                        })->orWhere(function ($resolvedCalls) {
                            $resolvedCalls->where('status', 'resolved')
                                ->whereRaw('COALESCE(resolved_at, closed_at) > sla_breach_at');
                        });
                    });
            })
            ->when($priority   !== 'all', fn($q) => $q->where('priority',  $priority))
            ->when($type       !== 'all', fn($q) => $q->where('call_type', $type))
            ->when($dateFrom || $dateTo, function ($query) use ($dateFrom, $dateTo) {
                $query->where(function ($dateRange) use ($dateFrom, $dateTo) {
                    $dateRange->where(function ($createdDuringRange) use ($dateFrom, $dateTo) {
                        $createdDuringRange
                            ->when($dateFrom, fn($q) => $q->whereDate('created_at', '>=', $dateFrom))
                            ->when($dateTo, fn($q) => $q->whereDate('created_at', '<=', $dateTo));
                    })->orWhere('status', '!=', 'resolved');
                });
            })
            ->when($engineerId,           fn($q) => $q->where('assigned_engineer_id', $engineerId))
            ->with(['atm.bank', 'engineer', 'assignedBy'])
            ->withCount('jobCards');

        if ($perPage !== null) {
            $sortColumns = [
                'created_at' => 'created_at',
                'assigned_at' => 'assigned_at',
                'call_type' => 'call_type',
                'priority' => 'priority',
                'status' => 'status',
                'atm' => 'atm_id',
                'engineer' => 'assigned_engineer_id',
            ];
            $validatedSort = $request->validate([
                'sort' => ['sometimes', 'in:created_at,assigned_at,call_type,priority,status,atm,engineer'],
                'direction' => ['sometimes', 'in:asc,desc'],
            ]);

            $sortDirection = $validatedSort['direction'] ?? 'desc';
            if (($validatedSort['sort'] ?? null) === 'priority') {
                $query->orderByRaw("CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END {$sortDirection}");
            } elseif (($validatedSort['sort'] ?? null) === 'status') {
                $query->orderByRaw("CASE status WHEN 'escalated' THEN 1 WHEN 'pending' THEN 2 WHEN 'assigned' THEN 3 WHEN 'on_hold' THEN 4 WHEN 'resolved' THEN 5 ELSE 6 END {$sortDirection}");
            } elseif (($validatedSort['sort'] ?? null) === 'atm') {
                $query->orderByRaw("(SELECT terminal_id FROM atms WHERE atms.id = calls.atm_id) {$sortDirection}");
            } elseif (($validatedSort['sort'] ?? null) === 'engineer') {
                $query->orderByRaw("(SELECT name FROM engineers WHERE engineers.id = calls.assigned_engineer_id) {$sortDirection}");
            } elseif (isset($validatedSort['sort'])) {
                $query->orderBy($sortColumns[$validatedSort['sort']], $sortDirection);
            } else {
                $query
                    ->orderByRaw("CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END")
                    ->orderByRaw("CASE status WHEN 'escalated' THEN 1 WHEN 'pending' THEN 2 WHEN 'assigned' THEN 3 WHEN 'on_hold' THEN 4 WHEN 'resolved' THEN 5 ELSE 6 END")
                    ->orderByDesc('created_at');
            }

            return response()->json(
                $query->orderByDesc('id')->paginate($perPage)->through(fn ($call) => $this->format($call))
            );
        }

        $calls = $query
            ->orderByRaw("CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END")
            ->orderByRaw("CASE status WHEN 'escalated' THEN 1 WHEN 'pending' THEN 2 WHEN 'assigned' THEN 3 WHEN 'on_hold' THEN 4 WHEN 'resolved' THEN 5 ELSE 6 END")
            ->orderByDesc('created_at')
            ->get()
            ->map(fn($c) => $this->format($c));

        return response()->json($calls);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'atm_id'               => ['required', 'exists:atms,id'],
            'call_type'            => ['required', 'in:new,old,repeat'],
            'priority'             => ['required', 'in:low,medium,high'],
            'fault_description'    => ['required', 'string', 'min:5'],
            'notes'                => ['nullable', 'string'],
            'assigned_engineer_id' => ['nullable', 'exists:engineers,id'],
        ]);

        // Calculate SLA breach time from now
        $slaHours     = self::SLA_HOURS[$data['priority']] ?? 3;
        $slaBreachAt  = now()->addHours($slaHours);

        $call = Call::create([
            ...$data,
            'status'       => isset($data['assigned_engineer_id']) ? 'assigned' : 'pending',
            'assigned_by'  => Auth::id(),
            'assigned_at'  => isset($data['assigned_engineer_id']) ? now() : null,
            'sla_breach_at'=> $slaBreachAt,
        ]);

        $call->load(['atm.bank', 'engineer', 'assignedBy', 'jobCards']);
        return response()->json($this->format($call), 201);
    }

    public function update(Request $request, Call $call): JsonResponse
    {
        $data = $request->validate([
            'call_type'            => ['sometimes', 'in:new,old,repeat'],
            'priority'             => ['sometimes', 'in:low,medium,high'],
            'status'               => ['sometimes', 'in:pending,assigned,on_hold,escalated,resolved'],
            'fault_description'    => ['sometimes', 'string', 'min:5'],
            'assigned_engineer_id' => ['nullable', 'exists:engineers,id'],
            'notes'                => ['nullable', 'string'],
            'resolution_notes'     => ['nullable', 'string'],
        ]);

        // Recalculate SLA if priority changed
        if (isset($data['priority']) && $data['priority'] !== $call->priority) {
            $slaHours = self::SLA_HOURS[$data['priority']] ?? 3;
            $data['sla_breach_at'] = $call->created_at->copy()->addHours($slaHours);
        }

        // ── Trigger 1: Unassigning engineer → pending ────────────────────────────
        if (array_key_exists('assigned_engineer_id', $data)) {
            if (is_null($data['assigned_engineer_id'])) {
                // Engineer removed — revert to pending
                $data['status']      = 'pending';
                $data['assigned_at'] = null;
            } elseif ($data['assigned_engineer_id'] !== $call->assigned_engineer_id) {
                // New engineer assigned
                $data['assigned_at'] = now();
                if (!isset($data['status'])) $data['status'] = 'assigned';
            }
        }

        // ── Trigger 3: On Hold → back to pending when no engineer ─────────────
        if (isset($data['status']) && $data['status'] === 'pending') {
            // Explicitly set to pending — clear engineer if caller wants
            if (!isset($data['assigned_engineer_id'])) {
                $data['assigned_engineer_id'] = null;
                $data['assigned_at']          = null;
            }
        }

        // ── On Hold → Pending auto-transition ─────────────────────────────────
        // If moving FROM on_hold to a non-resolved state without assigning engineer → pending
        if ($call->status === 'on_hold' && isset($data['status']) &&
            !in_array($data['status'], ['on_hold','resolved','escalated']) &&
            empty($data['assigned_engineer_id']) && !$call->assigned_engineer_id) {
            $data['status'] = 'pending';
        }

        if (isset($data['status'])) {
            if ($data['status'] === 'escalated' && !$call->escalated_at) $data['escalated_at'] = now();
            if ($data['status'] === 'resolved') {
                if ($call->status !== 'resolved' || !$call->resolved_at) {
                    $data['resolved_at'] = now();
                }
                $resolvedAt = $data['resolved_at'] ?? $call->resolved_at;
                $data['sla_breached'] = $call->sla_breach_at && $resolvedAt->gt($call->sla_breach_at);
            }
        }

        $call->update($data);
        $call->load(['atm.bank', 'engineer', 'assignedBy', 'jobCards']);
        return response()->json($this->format($call));
    }

    public function destroy(Call $call): JsonResponse
    {
        $call->delete();
        return response()->json(['message' => 'Call deleted.']);
    }

    private function format(Call $call): array
    {
        $slaBreachAt = $call->sla_breach_at;
        $now         = now();

        // SLA status for frontend
        if ($call->status === 'resolved' && $slaBreachAt) {
            $resolvedAt = $call->resolved_at ?? $call->closed_at;
            $slaBreached = $resolvedAt ? $resolvedAt->gt($slaBreachAt) : false;
            $slaStatus = $slaBreached ? 'breached' : 'met';
        } elseif ($slaBreachAt) {
            $slaBreached = $now->gt($slaBreachAt);
            $slaStatus = $slaBreached ? 'breached' : 'active';
        } else {
            $slaBreached = false;
            $slaStatus = 'none';
        }

        $slaMinutes = $slaBreachAt
            ? (int) $now->diffInMinutes($slaBreachAt, false)
            : null;

        return [
            'id'                => $call->id,
            'call_type'         => $call->call_type,
            'status'            => $call->status,
            'priority'          => $call->priority,
            'fault_description' => $call->fault_description,
            'notes'             => $call->notes,
            'resolution_notes'  => $call->resolution_notes,
            'created_at'        => $call->created_at->toISOString(),
            'assigned_at'       => $call->assigned_at?->toISOString(),
            'resolved_at'       => $call->resolved_at?->toISOString(),
            'escalated_at'      => $call->escalated_at?->toISOString(),
            'closed_at'         => $call->closed_at?->toISOString(),
            'sla_breach_at'     => $slaBreachAt?->toISOString(),
            'sla_breached'      => $slaBreached,
            'sla_status'        => $slaStatus,   // 'active' | 'breached' | 'met' | 'none'
            'sla_minutes'       => $slaMinutes,  // negative = past breach
            'sla_hours_allowed' => self::SLA_HOURS[$call->priority] ?? 3,
            'job_cards_count'   => $call->job_cards_count ?? $call->jobCards->count(),
            'atm' => [
                'id'          => $call->atm->id,
                'terminal_id' => $call->atm->terminal_id,
                'location'    => $call->atm->location,
                'model'       => $call->atm->model,
                'status'      => $call->atm->status,
                'bank'        => [
                    'id'         => $call->atm->bank->id,
                    'name'       => $call->atm->bank->name,
                    'short_code' => $call->atm->bank->short_code,
                ],
            ],
            'engineer'    => $call->engineer ? [
                'id'     => $call->engineer->id,
                'name'   => $call->engineer->name,
                'region' => $call->engineer->region,
                'phone'  => $call->engineer->phone,
            ] : null,
            'assigned_by' => $call->assignedBy?->name,
        ];
    }
}
