<?php

namespace App\Http\Controllers\Auth;

use App\Events\RegisteredUser;
use App\Http\Controllers\Controller;
use App\Models\PendingShareDestination;
use App\Models\User;
use App\Services\SendGridService;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Illuminate\View\View;
use Illuminate\Http\Response;
use Http;
use Firebase\JWT\JWT;
use Firebase\JWT\JWK;
use stdClass;
use Symfony\Component\HttpFoundation\JsonResponse;

class RegisteredUserController extends Controller
{
    /**
     * Display the registration view.
     */
    public function create(): View
    {
        return view('auth.register');
    }

    public function testEmail(SendGridService $sendGrid): JsonResponse 
    {
        $response = $sendGrid->send('dev@kay.tours', SendGridService::VerifyEmailTemplate, [
            "name" => "Joaco",
            "verificationLink" => "https://google.com/",
        ]);

        if (isset($response['error'])) 
            return response()->json($response, 500);
    
        return response()->json($response);
    }

    public function storeFacebookUser(Request $request): Response
    {
        $request->validate([
            'accessToken' => 'required|string',
        ]);

        $accessToken = $request->input('accessToken');

        try {
            $response = Http::get('https://graph.facebook.com/me', [
                'fields' => 'id,name,email,picture',
                'access_token' => $accessToken,
            ]);

            if ($response->failed()) {
                return response()->json(['error' => 'Invalid or expired access token'], 401);
            }

            $facebookData = $response->json();

            if (empty($facebookData['email'])) {
                return response()->json(['error' => 'Email not provided by Facebook'], 401);
            }

            $email = $facebookData['email'];
            $facebookId = $facebookData['id'];
            $name = $facebookData['name'];
            $profilePicture = $facebookData['picture']['data']['url'] ?? null;

            $user = User::where('email', $email)->first();

            if (!$user) {
                $user = User::create([
                    'name' => $name,
                    'email' => $email,
                    'facebook_id' => $facebookId,
                    'profile_picture' => $profilePicture,
                    'password' => Hash::make(uniqid()), 
                ]);

                $this->attachSharedProducts($user);

                event(new Registered($user));
            } else {
                if (is_null($user->facebook_id)) {
                    $user->update(['facebook_id' => $facebookId]);
                }
            }

            return new Response([
                'token' => $user->createToken($user->email)->plainTextToken,
                'user' => $user->toArray(),
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Error validating access token or fetching user data'], 500);
        }
    }


    public function storeAppleUser(Request $request): Response
    {
        $request->validate([
            'identityToken' => 'required|string',
            'authorizationCode' => 'required|string',
        ]);

        $identityToken = $request->input('identityToken');

        try {
            $keys = Http::get('https://appleid.apple.com/auth/keys')->json();
            $headers = new stdClass();
            $decodedToken = JWT::decode($identityToken, JWK::parseKeySet($keys, 'RS256'), $headers);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Invalid identity token'], 401);
        }

        $decodedToken = null;

        try {
            $decodedToken = json_decode(base64_decode(explode('.', $identityToken)[1]), true);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Invalid token'], 401);
        }

        if (!$decodedToken || empty($decodedToken['email'])) {
            return response()->json(['error' => 'Invalid token or email missing'], 401);
        }

        $email = $decodedToken['email'];
        $appleId = $decodedToken['sub'];
        $name = $request->input('fullName', null);

        $user = User::where('email', $email)->first();

        if (!$user) {
            $user = User::create([
                'name' => $name ?? '', 
                'email' => $email,
                'apple_id' => $appleId,
                'password' => Hash::make(uniqid()),
            ]);

            $this->attachSharedProducts($user);

            event(new Registered($user));
        } else {
            if (is_null($user->apple_id)) {
                $user->update(['apple_id' => $appleId]);
            }
        }

        return new Response([
            'token' => $user->createToken($user->email)->plainTextToken,
            'user' => $user->toArray(),
        ]);
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
    
        $user = User::where('email', $googleData['email'])->first();

        if (!$user) {
            $user = User::create([
                'name' => $googleData['name'],
                'email' => $googleData['email'],
                'google_id' => $googleData['sub'], 
                'profile_picture' => $googleData['picture'] ?? null,
                'password' => Hash::make(uniqid()),
            ]);

            $this->attachSharedProducts($user);
    
            event(new Registered($user));
        } else {
            if (is_null($user->google_id)) {
                $user->update(['google_id' => $googleData['sub']]);
            }
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

        $this->attachSharedProducts($user);

        event(new RegisteredUser($user));

        return new Response([
            'token' => $user->createToken($request->email)->plainTextToken,
            'user' => $user->toArray(),
        ]);
    }

    private function attachSharedProducts($user) {
        $pendingShares = PendingShareDestination::where('email', $user->email)->get();
        
        foreach ($pendingShares as $pendingShare) {
            $user->products()->attach($pendingShare->product_id);
            $pendingShare->delete();
        }
    }
}
