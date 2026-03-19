<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Engineer;
use App\Models\JobCard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class JobCardController extends Controller
{
    // ── Helpers ────────────────────────────────────────────────────────────────

    private function engineerFromRequest(Request $request): Engineer
    {
        return Engineer::where('user_id', $request->user()->id)->firstOrFail();
    }

    private function formatCard(JobCard $card): array
    {
        $card->load(['atm.bank', 'engineer', 'reviewer']);
        return [
            'id'               => $card->id,
            'status'           => $card->status,
            'type'             => $card->type,
            'work_description' => $card->work_description,
            'parts_used'       => $card->parts_used,
            'hours_spent'      => $card->hours_spent,
            'scheduled_date'   => $card->scheduled_date?->format('Y-m-d'),
            'completed_date'   => $card->completed_date?->format('Y-m-d'),
            'quarter'          => $card->quarter,
            'year'             => $card->year,
            'notes'            => $card->notes,
            'rejection_reason' => $card->rejection_reason,
            'photos'           => $card->photos ?? [],
            'attachments'      => collect($card->attachments ?? [])->map(fn($a) => array_merge($a, ['url' => \Illuminate\Support\Facades\Storage::url($a['path'] ?? ''), 'is_image' => str_starts_with($a['type'] ?? '', 'image/'), 'is_pdf' => ($a['type'] ?? '') === 'application/pdf']))->toArray(),
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
            'work_description' => ['required', 'string'],
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
            'work_description' => ['sometimes', 'string'],
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
        $status = $request->query('status', 'submitted');
        $cards = JobCard::when($status !== 'all', fn($q) => $q->where('status', $status))
            ->with(['atm.bank', 'engineer', 'reviewer'])
            ->orderByDesc('submitted_at')
            ->get()
            ->map(fn($c) => $this->formatCard($c));
        return response()->json($cards);
    }

    public function approve(Request $request, JobCard $jobCard): JsonResponse
    {
        if ($jobCard->status !== 'submitted') return response()->json(['message' => 'Only submitted cards can be approved.'], 422);
        $jobCard->update(['status' => 'approved', 'reviewed_by' => $request->user()->id, 'reviewed_at' => now()]);
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
