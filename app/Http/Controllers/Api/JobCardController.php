<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Engineer;
use App\Models\JobCard;
use App\Models\MaintenanceRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class JobCardController extends Controller
{
    // ── Helpers ────────────────────────────────────────────────────────────────

    private function engineerFromRequest(Request $request): Engineer
    {
        return Engineer::where('user_id', $request->user()->id)->firstOrFail();
    }

    private function formatCard(JobCard $card): array
    {
        $card->loadMissing(['atm.bank', 'engineer', 'reviewer']);
        return [
            'id'               => $card->id,
            'status'           => $card->status,
            'type'             => $card->type,
            'job_type'         => $card->job_type,
            'work_description' => $card->work_description,
            'fault_category'   => $card->fault_category,
            'checklist'        => $card->checklist ?? [],
            'atm_status'       => $card->atm_status,
            'phone_support'    => $card->phone_support,
            'start_time'       => $card->start_time,
            'end_time'         => $card->end_time,
            'technician_signature' => $card->technician_signature,
            'custodian1_name'  => $card->custodian1_name,
            'custodian1_signature' => $card->custodian1_signature,
            'custodian2_name'  => $card->custodian2_name,
            'custodian2_signature' => $card->custodian2_signature,
            'parts_used'       => $card->parts_used,
            'hours_spent'      => $card->hours_spent,
            'scheduled_date'   => $card->scheduled_date?->format('Y-m-d'),
            'completed_date'   => $card->completed_date?->format('Y-m-d'),
            'quarter'          => $card->quarter,
            'year'             => $card->year,
            'notes'            => $card->notes,
            'rejection_reason' => $card->rejection_reason,
            'photos'           => $card->photos ?? [],
            'attachments'      => collect($card->attachments ?? [])->map(fn($a) => array_merge($a, ['url' => Storage::url($a['path'] ?? ''), 'is_image' => str_starts_with($a['type'] ?? '', 'image/'), 'is_pdf' => ($a['type'] ?? '') === 'application/pdf']))->toArray(),
            'submitted_at'     => $card->submitted_at?->toISOString(),
            'reviewed_at'      => $card->reviewed_at?->toISOString(),
            'created_at'       => $card->created_at->toISOString(),
            'atm' => [
                'id'          => $card->atm->id,
                'terminal_id' => $card->atm->terminal_id,
                'location'    => $card->atm->location,
                'model'       => $card->atm->model,
                'status'      => $card->atm->status,
                'bank'        => [
                    'id'         => $card->atm->bank->id,
                    'name'       => $card->atm->bank->name,
                    'short_code' => $card->atm->bank->short_code,
                ],
            ],
            'engineer' => $card->engineer ? [
                'id' => $card->engineer->id,
                'name' => $card->engineer->name,
            ] : null,
            'reviewer' => $card->reviewer ? ['name' => $card->reviewer->name] : null,
        ];
    }

    // ── Engineer endpoints ─────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $engineer = $this->engineerFromRequest($request);
        $cards = JobCard::forEngineer($engineer->id)
            ->with(['atm.bank'])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn($c) => $this->formatCard($c));
        return response()->json($cards);
    }

    public function store(Request $request): JsonResponse
    {
        $engineer = $this->engineerFromRequest($request);
        $data = $request->validate([
            'atm_id'           => ['required', 'exists:atms,id'],
            'type'             => ['required', 'string'],
            'job_type'         => ['nullable', 'in:repair,maintenance'],
            'work_description' => ['required', 'string'],
            'fault_category'   => ['required_if:job_type,repair', 'nullable', 'string', 'max:100'],
            'checklist'        => ['required_if:job_type,maintenance', 'nullable', 'array'],
            'checklist.*'      => ['array'],
            'checklist.*.*'    => ['required', 'in:ok,na,nr,fail'],
            'atm_status'       => ['required_if:job_type,repair,maintenance', 'nullable', 'in:In Service,Out of Service,Pending Parts'],
            'start_time'       => ['required_if:job_type,repair,maintenance', 'nullable', 'date_format:H:i'],
            'end_time'         => ['required_if:job_type,repair,maintenance', 'nullable', 'date_format:H:i'],
            'technician_signature' => ['required_if:job_type,repair,maintenance', 'nullable', 'string', 'max:500000'],
            'custodian1_name'  => ['required_if:job_type,repair,maintenance', 'nullable', 'string', 'max:255'],
            'custodian1_signature' => ['required_if:job_type,repair,maintenance', 'nullable', 'string', 'max:500000'],
            'custodian2_name'  => ['nullable', 'required_with:custodian2_signature', 'string', 'max:255'],
            'custodian2_signature' => ['nullable', 'required_with:custodian2_name', 'string', 'max:500000'],
            'parts_used'       => ['nullable', 'string'],
            'hours_spent'      => ['required', 'numeric', 'min:0', 'max:24'],
            'scheduled_date'   => ['required', 'date'],
            'completed_date'   => ['nullable', 'date'],
            'quarter'          => ['required', 'integer', 'between:1,4'],
            'year'             => ['required', 'integer', 'min:2020'],
            'notes'            => ['nullable', 'string'],
        ]);
        $card = JobCard::create([...$data, 'engineer_id' => $engineer->id, 'status' => 'draft']);
        return response()->json($this->formatCard($card), 201);
    }

    public function show(Request $request, JobCard $jobCard): JsonResponse
    {
        $engineer = $this->engineerFromRequest($request);
        if ($jobCard->engineer_id !== $engineer->id) return response()->json(['message' => 'Not found.'], 404);
        return response()->json($this->formatCard($jobCard));
    }

    public function update(Request $request, JobCard $jobCard): JsonResponse
    {
        $engineer = $this->engineerFromRequest($request);
        if ($jobCard->engineer_id !== $engineer->id) return response()->json(['message' => 'Not found.'], 404);
        if ($jobCard->status !== 'draft') return response()->json(['message' => 'Only drafts can be edited.'], 422);
        $data = $request->validate([
            'type'             => ['sometimes', 'string'],
            'job_type'         => ['sometimes', 'nullable', 'in:repair,maintenance'],
            'work_description' => ['sometimes', 'string'],
            'fault_category'   => ['sometimes', 'required_if:job_type,repair', 'nullable', 'string', 'max:100'],
            'checklist'        => ['sometimes', 'required_if:job_type,maintenance', 'nullable', 'array'],
            'checklist.*'      => ['array'],
            'checklist.*.*'    => ['required', 'in:ok,na,nr,fail'],
            'atm_status'       => ['sometimes', 'required_if:job_type,repair,maintenance', 'nullable', 'in:In Service,Out of Service,Pending Parts'],
            'start_time'       => ['sometimes', 'required_if:job_type,repair,maintenance', 'nullable', 'date_format:H:i'],
            'end_time'         => ['sometimes', 'required_if:job_type,repair,maintenance', 'nullable', 'date_format:H:i'],
            'technician_signature' => ['sometimes', 'required_if:job_type,repair,maintenance', 'nullable', 'string', 'max:500000'],
            'custodian1_name'  => ['sometimes', 'required_if:job_type,repair,maintenance', 'nullable', 'string', 'max:255'],
            'custodian1_signature' => ['sometimes', 'required_if:job_type,repair,maintenance', 'nullable', 'string', 'max:500000'],
            'custodian2_name'  => ['sometimes', 'nullable', 'required_with:custodian2_signature', 'string', 'max:255'],
            'custodian2_signature' => ['sometimes', 'nullable', 'required_with:custodian2_name', 'string', 'max:500000'],
            'parts_used'       => ['nullable', 'string'],
            'hours_spent'      => ['sometimes', 'numeric', 'min:0', 'max:24'],
            'scheduled_date'   => ['sometimes', 'date'],
            'completed_date'   => ['nullable', 'date'],
            'quarter'          => ['sometimes', 'integer', 'between:1,4'],
            'year'             => ['sometimes', 'integer', 'min:2020'],
            'notes'            => ['nullable', 'string'],
        ]);
        $jobCard->update($data);
        return response()->json($this->formatCard($jobCard));
    }

    public function destroy(Request $request, JobCard $jobCard): JsonResponse
    {
        $engineer = $this->engineerFromRequest($request);
        if ($jobCard->engineer_id !== $engineer->id) return response()->json(['message' => 'Not found.'], 404);
        if ($jobCard->status !== 'draft') return response()->json(['message' => 'Only drafts can be deleted.'], 422);
        $jobCard->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    public function uploadPhotos(Request $request, JobCard $jobCard): JsonResponse
    {
        $engineer = $this->engineerFromRequest($request);
        if ($jobCard->engineer_id !== $engineer->id) return response()->json(['message' => 'Not found.'], 404);
        $request->validate(['photos' => ['required', 'array', 'max:5'], 'photos.*' => ['image', 'max:5120']]);
        $paths = $jobCard->photos ?? [];
        foreach ($request->file('photos') as $photo) {
            $paths[] = $photo->store("job-cards/{$jobCard->id}", 'public');
        }
        $jobCard->update(['photos' => $paths]);
        return response()->json(['photos' => $paths, 'urls' => array_map(fn($p) => Storage::url($p), $paths)]);
    }

    public function submit(Request $request, JobCard $jobCard): JsonResponse
    {
        $engineer = $this->engineerFromRequest($request);
        if ($jobCard->engineer_id !== $engineer->id) return response()->json(['message' => 'Not found.'], 404);
        if ($jobCard->status !== 'draft') return response()->json(['message' => 'Only drafts can be submitted.'], 422);
        $jobCard->update(['status' => 'submitted', 'submitted_at' => now()]);
        return response()->json($this->formatCard($jobCard));
    }

    // ── Admin endpoints ────────────────────────────────────────────────────────

    public function adminIndex(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['sometimes', Rule::in(['all', 'submitted', 'approved', 'rejected', 'draft'])],
            'per_page' => ['sometimes', 'integer', 'between:1,100'],
            'search' => ['sometimes', 'nullable', 'string', 'max:120'],
            'job_type' => ['sometimes', Rule::in(['all', 'maintenance', 'repair'])],
        ]);
        $status = $filters['status'] ?? 'submitted';
        $perPage = $filters['per_page'] ?? 15;
        $search = trim($filters['search'] ?? '');
        $jobType = $filters['job_type'] ?? 'all';

        $applyFilters = static function ($query) use ($search, $jobType) {
            return $query
                ->when($search !== '', function ($query) use ($search): void {
                    $query->where(function ($matches) use ($search): void {
                        if (ctype_digit($search)) {
                            $matches->where('id', (int) $search);
                        }

                        $matches->orWhere('type', 'like', "%{$search}%")
                            ->orWhereHas('atm', function ($atm) use ($search): void {
                                $atm->where('terminal_id', 'like', "%{$search}%")
                                    ->orWhere('location', 'like', "%{$search}%")
                                    ->orWhereHas('bank', function ($bank) use ($search): void {
                                        $bank->where('name', 'like', "%{$search}%")
                                            ->orWhere('short_code', 'like', "%{$search}%");
                                    });
                            })
                            ->orWhereHas('engineer', fn($engineer) => $engineer->where('name', 'like', "%{$search}%"));
                    });
                })
                ->when($jobType === 'repair', fn($query) => $query->where('job_type', 'repair'))
                ->when($jobType === 'maintenance', fn($query) => $query->where(function ($query): void {
                    $query->where('job_type', 'maintenance')
                        ->orWhere(fn($legacy) => $legacy->whereNull('job_type')->where('type', 'Quarterly PM'));
                }));
        };

        $cardsQuery = $applyFilters(JobCard::query())
            ->when($status !== 'all', fn($query) => $query->where('status', $status));
        $cards = $cardsQuery
            ->with(['atm.bank', 'engineer', 'reviewer'])
            ->orderByDesc('submitted_at')
            ->orderByDesc('id')
            ->paginate($perPage);

        $countsByStatus = $applyFilters(JobCard::query())
            ->selectRaw('status, COUNT(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status');
        $counts = [
            'all' => (int) $countsByStatus->sum(),
            'submitted' => (int) $countsByStatus->get('submitted', 0),
            'approved' => (int) $countsByStatus->get('approved', 0),
            'rejected' => (int) $countsByStatus->get('rejected', 0),
            'draft' => (int) $countsByStatus->get('draft', 0),
        ];

        return response()->json([
            'data' => $cards->getCollection()->map(fn(JobCard $card) => $this->formatCard($card)),
            'meta' => [
                'current_page' => $cards->currentPage(),
                'last_page' => $cards->lastPage(),
                'per_page' => $cards->perPage(),
                'total' => $cards->total(),
            ],
            'counts' => $counts,
        ]);
    }

    public function approve(Request $request, JobCard $jobCard): JsonResponse
    {
        if ($jobCard->status !== 'submitted') return response()->json(['message' => 'Only submitted cards can be approved.'], 422);

        DB::transaction(function () use ($request, $jobCard): void {
            $jobCard->update(['status' => 'approved', 'reviewed_by' => $request->user()->id, 'reviewed_at' => now()]);

            $isPmCard = ($jobCard->job_type === 'maintenance' && $jobCard->type === 'Quarterly PM')
                || ($jobCard->job_type === null && $jobCard->type === 'Quarterly PM');

            if ($isPmCard) {
                $completedDate = ($jobCard->completed_date ?? $jobCard->scheduled_date)?->format('Y-m-d');

                MaintenanceRecord::query()
                    ->where('atm_id', $jobCard->atm_id)
                    ->where('type', 'Quarterly PM')
                    ->where('quarter', $jobCard->quarter)
                    ->where('year', $jobCard->year)
                    ->whereIn('status', ['Scheduled', 'In Progress'])
                    ->update([
                        'status' => 'Completed',
                        'completed_date' => $completedDate,
                    ]);
            }
        });

        return response()->json($this->formatCard($jobCard));
    }

    public function reject(Request $request, JobCard $jobCard): JsonResponse
    {
        if ($jobCard->status !== 'submitted') return response()->json(['message' => 'Only submitted cards can be rejected.'], 422);
        $request->validate(['reason' => ['required', 'string', 'min:5']]);
        $jobCard->update([
            'status'           => 'rejected',
            'rejection_reason' => $request->reason,
            'reviewed_by'      => $request->user()->id,
            'reviewed_at'      => now(),
        ]);
        return response()->json($this->formatCard($jobCard));
    }
}
