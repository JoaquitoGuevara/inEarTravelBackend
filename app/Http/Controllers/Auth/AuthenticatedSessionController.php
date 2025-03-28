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

    public function setExpoPushToken(Request $request) {
        $request->validate([
            'token' => 'required',
        ]);

        $user = $request->user();
        $user->expo_push_token = $request->token;
        $user->save();

        return response()->json([
            'message' => 'Expo push token saved successfully',
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

        $user->tokens()->delete();
    
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

    /**
     * Delete the user's account.
     */
    public function deleteAccount(Request $request): Response
    {
        $user = $request->user();
        
        $user->tokens()->delete();
        $user->delete();

        return new Response('Account deleted successfully');
    }

    public function requestDeletion(Request $request): Response
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            return new Response([
                'message' => 'User not found.',
            ], 404);
        }
        if (!Hash::check($request->password, $user->password)) {
            return new Response([
                'message' => 'The provided credentials are incorrect.',
            ], 401);
        }

        $user->tokens()->delete();
        $user->delete();

        return new Response('Account deleted successfully');
    }
}
