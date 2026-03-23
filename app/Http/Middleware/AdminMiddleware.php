<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdminMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!$request->user()?->is_admin) {

            // Inertia requests — redirect to engineer portal if they have a profile,
            // otherwise redirect to login. Never return JSON for Inertia navigations.
            if ($request->header('X-Inertia')) {
                $engineer = \App\Models\Engineer::where('user_id', $request->user()?->id)->first();
                if ($engineer) {
                    return redirect()->route('engineer.portal');
                }
                return redirect()->route('login');
            }

            // Plain JSON / AJAX fetch calls (e.g. JobCardsModule API calls)
            if ($request->expectsJson() || $request->ajax()) {
                return response()->json(['message' => 'Forbidden. Admin access required.'], 403);
            }

            // Plain browser request
            $engineer = \App\Models\Engineer::where('user_id', $request->user()?->id)->first();
            if ($engineer) {
                return redirect()->route('engineer.portal');
            }

            abort(403, 'Access denied.');
        }

        return $next($request);
    }
}
