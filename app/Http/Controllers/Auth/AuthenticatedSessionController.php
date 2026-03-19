<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Engineer;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    /**
     * Show the login page.
     * If already logged in, redirect to the correct portal.
     */
    public function create(): Response|RedirectResponse
    {
        if (Auth::check()) {
            return $this->redirectAfterLogin();
        }

        return Inertia::render('auth/login');
    }

    /**
     * Handle login — shared for both admins and engineers.
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'email'    => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (!Auth::attempt($request->only('email', 'password'), $request->boolean('remember'))) {
            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }

        $request->session()->regenerate();

        return $this->redirectAfterLogin();
    }

    /**
     * Destroy the session (logout) — redirect to login regardless of role.
     */
    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/login');
    }

    /**
     * Decide where to send the user after login:
     * - Has an engineer profile → /engineer
     * - No engineer profile (pure admin) → /
     */
    private function redirectAfterLogin(): RedirectResponse
    {
        $engineer = Engineer::where('user_id', Auth::id())->first();

        if ($engineer) {
            return redirect()->route('engineer.portal');
        }

        return redirect()->route('atm.fleet');
    }
}
