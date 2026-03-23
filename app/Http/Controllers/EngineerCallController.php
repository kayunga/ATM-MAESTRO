<?php

namespace App\Http\Controllers;

use App\Models\Call;
use App\Models\Engineer;
use App\Models\JobCard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class EngineerCallController extends Controller
{
    const SLA_HOURS = ['high' => 2, 'medium' => 3, 'low' => 5];

    public function index(Request $request): JsonResponse
    {
        // Refresh sla_breached flags
        Call::whereNotIn('status', ['resolved','escalated'])
            ->whereNotNull('sla_breach_at')
            ->where('sla_breached', false)
            ->where('sla_breach_at', '<', now())
            ->update(['sla_breached' => true]);

        // Auto-age new calls to "old" if logged on a previous date
        Call::whereNotIn('status', ['resolved','escalated'])
            ->where('call_type', 'new')
            ->whereDate('created_at', '<', now()->toDateString())
            ->update(['call_type' => 'old']);

        $calls = Call::with(['atm.bank', 'engineer', 'jobCards'])
            ->whereNotIn('status', ['resolved'])
            ->orderByRaw("CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END")
            ->orderByDesc('created_at')
            ->get()
            ->map(fn($c) => $this->format($c));

        return response()->json($calls);
    }

    public function close(Request $request, Call $call): JsonResponse
    {
        $engineer = Engineer::where('user_id', Auth::id())->firstOrFail();

        if ($call->assigned_engineer_id && $call->assigned_engineer_id !== $engineer->id) {
            return response()->json(['message' => 'This call is assigned to a different engineer.'], 403);
        }

        $data = $request->validate([
            'resolution_notes' => ['required', 'string', 'min:10'],
            'closed_at'        => ['required', 'date'],   // custom datetime from engineer
            'work_description' => ['required', 'string'],
            'parts_used'       => ['nullable', 'string'],
            'notes'            => ['nullable', 'string'],
            'submit_now'       => ['nullable'],
            'files'            => ['nullable', 'array', 'max:10'],
            'files.*'          => ['file', 'max:20480', 'mimes:jpg,jpeg,png,gif,pdf,doc,docx'],
        ]);

        $closedAt    = \Carbon\Carbon::parse($data['closed_at']);
        $submitNow   = filter_var($request->input('submit_now'), FILTER_VALIDATE_BOOLEAN);
        $attachments = [];

        if ($request->hasFile('files')) {
            foreach ($request->file('files') as $file) {
                $path = $file->store("job-cards/{$engineer->id}", 'public');
                $attachments[] = [
                    'name' => $file->getClientOriginalName(),
                    'path' => $path,
                    'type' => $file->getMimeType(),
                    'size' => $file->getSize(),
                ];
            }
        }

        // Determine if SLA was breached at close time
        $slaBreached = $call->sla_breach_at && $closedAt->gt($call->sla_breach_at);

        // Create job card linked to this call
        $quarter = (int) ceil($closedAt->month / 3);
        JobCard::create([
            'atm_id'           => $call->atm_id,
            'engineer_id'      => $engineer->id,
            'call_id'          => $call->id,
            'type'             => 'Emergency',
            'work_description' => $data['work_description'],
            'parts_used'       => $data['parts_used'] ?? null,
            'hours_spent'      => round($call->created_at->diffInMinutes($closedAt) / 60, 1),
            'scheduled_date'   => $call->created_at->format('Y-m-d'),
            'completed_date'   => $closedAt->format('Y-m-d'),
            'quarter'          => $quarter,
            'year'             => $closedAt->year,
            'notes'            => $data['notes'] ?? null,
            'status'           => $submitNow ? 'submitted' : 'draft',
            'submitted_at'     => $submitNow ? now() : null,
            'attachments'      => !empty($attachments) ? $attachments : null,
        ]);

        // Resolve the call
        $call->update([
            'status'               => 'resolved',
            'resolution_notes'     => $data['resolution_notes'],
            'resolved_at'          => now(),
            'closed_at'            => $closedAt,
            'sla_breached'         => $slaBreached,
            'assigned_engineer_id' => $engineer->id,
            'assigned_at'          => $call->assigned_at ?? now(),
        ]);

        return response()->json([
            'message'     => 'Call closed successfully.',
            'sla_breached'=> $slaBreached,
            'sla_status'  => $slaBreached ? 'breached' : 'met',
        ]);
    }

    // ── Return call to pending pool ───────────────────────────────────────────

    public function saveNote(Request $request, Call $call): JsonResponse
    {
        $engineer = Engineer::where('user_id', Auth::id())->firstOrFail();

        $data = $request->validate([
            'notes' => ['required', 'string', 'min:3'],
        ]);

        $call->update(['notes' => $data['notes']]);
        return response()->json(['message' => 'Note saved.']);
    }

    public function returnCall(Request $request, Call $call): JsonResponse
    {
        $engineer = Engineer::where('user_id', Auth::id())->firstOrFail();

        if ($call->assigned_engineer_id !== $engineer->id) {
            return response()->json(['message' => 'You are not assigned to this call.'], 403);
        }

        if (in_array($call->status, ['resolved', 'escalated'])) {
            return response()->json(['message' => 'Cannot return a closed call.'], 422);
        }

        $call->update([
            'assigned_engineer_id' => null,
            'assigned_at'          => null,
            'status'               => 'pending',
        ]);

        return response()->json(['message' => 'Call returned to pending pool.']);
    }

    public function assign(Request $request, Call $call): JsonResponse
    {
        $engineer = Engineer::where('user_id', Auth::id())->firstOrFail();

        if ($call->assigned_engineer_id) {
            return response()->json(['message' => 'Call is already assigned.'], 422);
        }

        $call->update([
            'assigned_engineer_id' => $engineer->id,
            'assigned_at'          => now(),
            'status'               => 'assigned',
        ]);

        return response()->json(['message' => 'Call assigned to you.']);
    }

    private function format(Call $call): array
    {
        $slaBreachAt = $call->sla_breach_at;
        $now         = now();
        $slaMinutes  = $slaBreachAt ? (int) $now->diffInMinutes($slaBreachAt, false) : null;
        $slaStatus   = $slaBreachAt
            ? ($now->gt($slaBreachAt) ? 'breached' : 'active')
            : 'none';

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
            'created_at'        => $call->created_at->toISOString(),
            'sla_breach_at'     => $slaBreachAt?->toISOString(),
            'sla_status'        => $slaStatus,
            'sla_minutes'       => $slaMinutes,
            'sla_hours_allowed' => self::SLA_HOURS[$call->priority] ?? 3,
            'job_cards_count'   => $call->jobCards->count(),
            'is_mine'           => $call->engineer?->user_id === Auth::id(),
            'atm' => [
                'id'          => $call->atm->id,
                'terminal_id' => $call->atm->terminal_id,
                'location'    => $call->atm->location,
                'model'       => $call->atm->model,
                'bank'        => [
                    'id'         => $call->atm->bank->id,
                    'name'       => $call->atm->bank->name,
                    'short_code' => $call->atm->bank->short_code,
                ],
            ],
            'engineer' => $call->engineer ? [
                'id'   => $call->engineer->id,
                'name' => $call->engineer->name,
            ] : null,
        ];
    }
}
