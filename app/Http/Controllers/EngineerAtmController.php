<?php

namespace App\Http\Controllers;

use App\Models\Engineer;
use App\Models\JobCard;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;

class EngineerPortalController extends Controller
{
    // ── Show portal (login or dashboard) ──────────────────────────────────────

    public function index()
    {
        $user     = Auth::user();
        $engineer = $user ? Engineer::where("user_id", $user->id)->first() : null;

        if (!$engineer) {
            return Inertia::render("engineer/portal");
        }

        $atms = $engineer->atms()->with("bank")->get()->map(fn($a) => [
            "id"          => $a->id,
            "terminal_id" => $a->terminal_id,
            "model"       => $a->model,
            "location"    => $a->location,
            "address"     => $a->address,
            "status"      => $a->status,
            "bank"        => ["id" => $a->bank->id, "name" => $a->bank->name, "short_code" => $a->bank->short_code],
        ]);

        $jobCards = JobCard::where("engineer_id", $engineer->id)
            ->with("atm.bank", "reviewer")
            ->orderByDesc("created_at")
            ->get()
            ->map(fn($c) => [
                "id"               => $c->id,
                "status"           => $c->status,
                "type"             => $c->type,
                "work_description" => $c->work_description,
                "parts_used"       => $c->parts_used,
                "hours_spent"      => $c->hours_spent,
                "scheduled_date"   => $c->scheduled_date?->format("Y-m-d"),
                "completed_date"   => $c->completed_date?->format("Y-m-d"),
                "quarter"          => $c->quarter,
                "year"             => $c->year,
                "notes"            => $c->notes,
                "rejection_reason" => $c->rejection_reason,
                "submitted_at"     => $c->submitted_at?->toISOString(),
                "reviewed_at"      => $c->reviewed_at?->toISOString(),
                "created_at"       => $c->created_at->toISOString(),
                "atm" => [
                    "id"          => $c->atm->id,
                    "terminal_id" => $c->atm->terminal_id,
                    "location"    => $c->atm->location,
                    "model"       => $c->atm->model,
                    "status"      => $c->atm->status,
                    "bank"        => ["id" => $c->atm->bank->id, "name" => $c->atm->bank->name, "short_code" => $c->atm->bank->short_code],
                ],
                "reviewer" => $c->reviewer ? ["name" => $c->reviewer->name] : null,
            ]);

        return Inertia::render("engineer/portal", [
            "engineer" => [
                "id"     => $engineer->id,
                "name"   => $engineer->name,
                "email"  => $user->email,
                "phone"  => $engineer->phone,
                "region" => $engineer->region,
            ],
            "atms"     => $atms,
            "jobCards" => $jobCards,
        ]);
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    public function login(Request $request)
    {
        $credentials = $request->validate([
            "email"    => ["required", "email"],
            "password" => ["required", "string"],
        ]);

        if (!Auth::attempt($credentials)) {
            return back()->withErrors(["email" => "Invalid credentials."])->onlyInput("email");
        }

        $request->session()->regenerate();

        return redirect()->route("engineer.portal");
    }

    // ── Logout ────────────────────────────────────────────────────────────────

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route("engineer.portal");
    }

    // ── Store Job Card ────────────────────────────────────────────────────────

    public function storeJobCard(Request $request)
    {
        $user     = Auth::user();
        $engineer = Engineer::where("user_id", $user->id)->firstOrFail();

        $data = $request->validate([
            "atm_id"           => ["required", "exists:atms,id"],
            "type"             => ["required", "string"],
            "work_description" => ["required", "string"],
            "parts_used"       => ["nullable", "string"],
            "hours_spent"      => ["required", "numeric", "min:0", "max:24"],
            "scheduled_date"   => ["required", "date"],
            "completed_date"   => ["nullable", "date"],
            "quarter"          => ["required", "integer", "between:1,4"],
            "year"             => ["required", "integer", "min:2020"],
            "notes"            => ["nullable", "string"],
            "submit_now"       => ["boolean"],
        ]);

        $submitNow = $request->boolean("submit_now");

        $card = JobCard::create([
            "atm_id"           => $data["atm_id"],
            "engineer_id"      => $engineer->id,
            "type"             => $data["type"],
            "work_description" => $data["work_description"],
            "parts_used"       => $data["parts_used"] ?? null,
            "hours_spent"      => $data["hours_spent"],
            "scheduled_date"   => $data["scheduled_date"],
            "completed_date"   => $data["completed_date"] ?? null,
            "quarter"          => $data["quarter"],
            "year"             => $data["year"],
            "notes"            => $data["notes"] ?? null,
            "status"           => $submitNow ? "submitted" : "draft",
            "submitted_at"     => $submitNow ? now() : null,
        ]);

        $msg = $submitNow
            ? "Job card submitted for review successfully."
            : "Job card saved as draft.";

        return redirect()->route("engineer.portal")->with("success", $msg);
    }
}
