<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Illuminate\View\View;
use Illuminate\Http\Response;

class RegisteredUserController extends Controller
{
    /**
     * Display the registration view.
     */
    public function create(): View
    {
        return view('auth.register');
    }

    public function storeGoogleUser(Request $request): Response {
        $request->validate([
            'idToken' => 'required|string',
        ]);
    
        $response = Http::get('https://oauth2.googleapis.com/tokeninfo', [
            'id_token' => $request->input('idToken'),
        ]);
    
        if ($response->failed()) {
            return response()->json(['error' => 'Invalid token'], 401);
        }
    
        $googleData = $response->json();
    
        $user = User::firstOrCreate(
            ['email' => $googleData['email']],
            [
                'name' => $googleData['name'],
                'google_id' => $googleData['sub'], 
                'profile_picture' => $googleData['picture'] ?? null,
                'password' => Hash::make(uniqid()),
            ]
        );
    
        if ($user->wasRecentlyCreated) {
            event(new Registered($user));
        }
    
        return new Response([
            'token' => $user->createToken($user->email)->plainTextToken,
            'user' => $user->toArray(),
        ]);
    }

    public function store(Request $request): Response
    {
        $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:'.User::class],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
        ]);

        event(new Registered($user));

        return new Response([
            'token' => $user->createToken($request->email)->plainTextToken,
            'user' => $user->toArray(),
        ]);
    }
}
