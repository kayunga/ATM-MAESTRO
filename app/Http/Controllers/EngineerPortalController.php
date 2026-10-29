<?php

namespace App\Http\Controllers;

use App\Models\Engineer;
use App\Models\JobCard;
use App\Models\MaintenanceRecord;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class EngineerPortalController extends Controller
{
    // ── Unified Login ─────────────────────────────────────────────────────────
    // One login page for all users. Redirects based on role:
    // is_admin=true  → admin dashboard (/)
    // has engineer profile → engineer portal (/engineer)
    // elevated engineer (both) → admin dashboard with portal switcher

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (!Auth::attempt($credentials, $request->boolean('remember'))) {
            return back()->withErrors(['email' => 'Invalid credentials.'])->onlyInput('email');
        }

        $request->session()->regenerate();

        $user     = Auth::user();
        $engineer = Engineer::where('user_id', $user->id)->first();

        // Admin (or elevated engineer with admin flag) → admin dashboard
        if ($user->is_admin) {
            return redirect()->intended(route('atm.fleet'));
        }

        // Engineer without admin flag → engineer portal
        if ($engineer) {
            return redirect()->route('engineer.portal');
        }

        // No role assigned
        Auth::logout();
        $request->session()->invalidate();
        return back()->withErrors([
            'email' => 'Your account has no assigned role. Contact your administrator.',
        ])->onlyInput('email');
    }

    // ── Logout ────────────────────────────────────────────────────────────────

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return redirect()->route('login');
    }

    // ── Engineer Portal Index ─────────────────────────────────────────────────

    public function index()
    {
        $user     = Auth::user();

        if (!$user) {
            return redirect()->route('login');
        }

        $engineer = Engineer::where('user_id', $user->id)->first();

        // Admin without engineer profile — send to admin dashboard
        if (!$engineer && $user->is_admin) {
            return redirect()->route('atm.fleet');
        }

        // No profile at all
        if (!$engineer) {
            return redirect()->route('login');
        }

        $atms = $engineer->atms()->with('bank')->get()->map(fn($a) => [
            'id'          => $a->id,
            'terminal_id' => $a->terminal_id,
            'serial_number' => $a->serial_number,
            'model'       => $a->model,
            'location'    => $a->location,
            'address'     => $a->address,
            'status'      => $a->status,
            'has_gbna'    => $a->has_gbna,
            'bank'        => [
                'id'         => $a->bank->id,
                'name'       => $a->bank->name,
                'short_code' => $a->bank->short_code,
            ],
        ]);

        $currentYear    = now()->year;
        $currentQuarter = (int) ceil(now()->month / 3);

        // Pre-load all current-quarter job cards keyed by atm_id to avoid N+1
        $jobCardsByAtm = JobCard::where('engineer_id', $engineer->id)
            ->where('quarter', $currentQuarter)
            ->where('year', $currentYear)
            ->pluck('id', 'atm_id');

        $pmRecords = MaintenanceRecord::where('engineer_id', $engineer->id)
            ->where('quarter', $currentQuarter)
            ->where('year', $currentYear)
            ->with('atm.bank')
            ->get()
            ->map(fn($m) => [
                'id'             => $m->id,
                'atm_id'         => $m->atm_id,
                'type'           => $m->type,
                'status'         => $m->status,
                'scheduled_date' => $m->scheduled_date?->format('Y-m-d'),
                'completed_date' => $m->completed_date?->format('Y-m-d'),
                'quarter'        => $m->quarter,
                'year'           => $m->year,
                'atm' => [
                    'id'          => $m->atm->id,
                    'terminal_id' => $m->atm->terminal_id,
                    'location'    => $m->atm->location,
                    'model'       => $m->atm->model,
                    'status'      => $m->atm->status,
                    'bank'        => [
                        'id'         => $m->atm->bank->id,
                        'name'       => $m->atm->bank->name,
                        'short_code' => $m->atm->bank->short_code,
                    ],
                ],
                'job_card_id' => $jobCardsByAtm[$m->atm_id] ?? null,
            ]);

        $jobCards = JobCard::where('engineer_id', $engineer->id)
            ->with('atm.bank', 'reviewer')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn($c) => $this->formatCard($c));

        return Inertia::render('engineer/portal', [
            'engineer'       => [
                'id'       => $engineer->id,
                'name'     => $engineer->name,
                'email'    => $user->email,
                'phone'    => $engineer->phone,
                'region'   => $engineer->region,
                'signature' => $engineer->signature,
                'is_admin' => $user->is_admin,  // elevated engineer flag
            ],
            'atms'           => $atms,
            'jobCards'       => $jobCards,
            'pmRecords'      => $pmRecords,
            'currentQuarter' => $currentQuarter,
            'currentYear'    => $currentYear,
        ]);
    }

    public function updateSignature(Request $request)
    {
        $engineer = Engineer::where('user_id', Auth::id())->firstOrFail();
        $data = $request->validate([
            'signature' => ['nullable', 'string', 'max:500000', 'regex:/\Adata:image\/png;base64,[A-Za-z0-9+\/]+=*\z/'],
        ]);

        $engineer->update(['signature' => $data['signature'] ?? null]);

        return redirect()->route('engineer.portal')->with('success', 'Engineer signature updated.');
    }

    // ── Store Job Card ────────────────────────────────────────────────────────

    public function storeJobCard(Request $request)
    {
        $engineer = Engineer::where('user_id', Auth::id())->firstOrFail();

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
            'submit_now'       => ['nullable'],
            'files'            => ['nullable', 'array', 'max:10'],
            'files.*'          => ['file', 'max:20480', 'mimes:jpg,jpeg,png,gif,pdf,doc,docx'],
        ]);

        $submitNow   = filter_var($request->input('submit_now'), FILTER_VALIDATE_BOOLEAN);
        if ($submitNow && in_array($data['job_type'] ?? null, ['repair', 'maintenance'], true) && !$engineer->signature) {
            return back()->withErrors(['signature' => 'Add your engineer signature in your profile before submitting a job card.']);
        }
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

        JobCard::create([
            'atm_id'           => $data['atm_id'],
            'engineer_id'      => $engineer->id,
            'type'             => $data['type'],
            'job_type'         => $data['job_type'] ?? null,
            'work_description' => $data['work_description'],
            'fault_category'   => $data['fault_category'] ?? null,
            'checklist'        => $data['checklist'] ?? null,
            'atm_status'       => $data['atm_status'] ?? null,
            'start_time'       => $data['start_time'] ?? null,
            'end_time'         => $data['end_time'] ?? null,
            'technician_signature' => $submitNow ? $engineer->signature : null,
            'custodian1_name'  => $data['custodian1_name'] ?? null,
            'custodian1_signature' => $data['custodian1_signature'] ?? null,
            'custodian2_name'  => $data['custodian2_name'] ?? null,
            'custodian2_signature' => $data['custodian2_signature'] ?? null,
            'parts_used'       => $data['parts_used'] ?? null,
            'hours_spent'      => $data['hours_spent'],
            'scheduled_date'   => $data['scheduled_date'],
            'completed_date'   => $data['completed_date'] ?? null,
            'quarter'          => $data['quarter'],
            'year'             => $data['year'],
            'notes'            => $data['notes'] ?? null,
            'status'           => $submitNow ? 'submitted' : 'draft',
            'submitted_at'     => $submitNow ? now() : null,
            'attachments'      => !empty($attachments) ? $attachments : null,
        ]);

        return redirect()->route('engineer.portal')->with(
            'success',
            $submitNow ? 'Job card submitted for review.' : 'Job card saved as draft.'
        );
    }

    // ── Submit Draft ──────────────────────────────────────────────────────────

    public function submitJobCard(Request $request, JobCard $jobCard)
    {
        $engineer = Engineer::where('user_id', Auth::id())->firstOrFail();
        abort_if($jobCard->engineer_id !== $engineer->id, 403);
        abort_if($jobCard->status !== 'draft', 422, 'Only drafts can be submitted.');

        if (in_array($jobCard->job_type, ['repair', 'maintenance'], true) && !$engineer->signature) {
            return back()->withErrors(['signature' => 'Add your engineer signature in your profile before submitting a job card.']);
        }

        $jobCard->update([
            'status' => 'submitted',
            'submitted_at' => now(),
            'technician_signature' => in_array($jobCard->job_type, ['repair', 'maintenance'], true)
                ? $engineer->signature
                : $jobCard->technician_signature,
        ]);

        return redirect()->route('engineer.portal')->with('success', 'Job card submitted for review.');
    }

    // ── Discard Draft ─────────────────────────────────────────────────────────

    public function destroyJobCard(Request $request, JobCard $jobCard)
    {
        $engineer = Engineer::where('user_id', Auth::id())->firstOrFail();
        abort_if($jobCard->engineer_id !== $engineer->id, 403);
        abort_if($jobCard->status !== 'draft', 422, 'Only drafts can be deleted.');

        $jobCard->delete();

        return redirect()->route('engineer.portal')->with('success', 'Draft discarded.');
    }

    // ── Format Card ───────────────────────────────────────────────────────────

    private function formatCard(JobCard $card): array
    {
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
            'attachments'      => array_map(fn($a) => array_merge($a, [
                'url'      => Storage::url($a['path']),
                'is_image' => str_starts_with($a['type'] ?? '', 'image/'),
                'is_pdf'   => ($a['type'] ?? '') === 'application/pdf',
            ]), $card->attachments ?? []),
            'submitted_at' => $card->submitted_at?->toISOString(),
            'reviewed_at'  => $card->reviewed_at?->toISOString(),
            'created_at'   => $card->created_at->toISOString(),
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
}
