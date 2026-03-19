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
            // JSON / XHR requests (fetch calls from JobCardsModule) get a clean 403
            if ($request->expectsJson() || $request->ajax()) {
                return response()->json(['message' => 'Forbidden. Admin access required.'], 403);
            }

            // Browser requests — redirect engineers to their portal
            $engineer = \App\Models\Engineer::where('user_id', $request->user()?->id)->first();
            if ($engineer) {
                return redirect()->route('engineer.portal');
            }

            abort(403, 'Access denied.');
        }

        return $next($request);
    }
}
