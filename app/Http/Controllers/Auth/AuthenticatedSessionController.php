<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\View\View;
use App\Models\User;
use Hash;
use Illuminate\Http\Response;

class AuthenticatedSessionController extends Controller
{
    public function userdata(Request $request): Response {
        return new Response([
            'user' => $request->user()->toArray(),
        ]);
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(Request $request): Response
    {
        // TODO: Implement throttling
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);
     
        $user = User::where('email', $request->email)->first();
     
        if (!$user || !Hash::check($request->password, $user->password)) {
            return new Response([
                'message' => 'The provided credentials are incorrect.',
            ], 401);
        }
    
        return new Response([
            'token' => $user->createToken($request->email)->plainTextToken,
            'user' => $user->toArray(),
        ]);
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): Response
    {
        $request->user()->tokens()->delete();

        return new Response('Logged out successfully');
    }
}
