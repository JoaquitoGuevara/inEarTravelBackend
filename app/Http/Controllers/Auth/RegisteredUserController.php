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

    public function storeFacebookUser(Request $request): JsonResponse
    {
        $request->validate([
            'accessToken' => 'required|string',
            'isLimitedLogin' => 'boolean',
        ]);

        $accessToken = $request->input('accessToken');
        $isLimitedLogin = $request->input('isLimitedLogin', false);

        try {
            if ($isLimitedLogin) {
                // For limited login, the accessToken is a JWT that we need to verify and decode.
                $jwksResponse = Http::get('https://www.facebook.com/.well-known/oauth/openid/jwks/');
                if ($jwksResponse->failed()) {
                    error_log('Failed to fetch JWKS keys from Facebook');
                    return response()->json(['message' => 'Failed to verify token'], 401);
                }
                $jwks = $jwksResponse->json();

                // Extract the header from the JWT to get the key id (kid)
                $parts = explode('.', $accessToken);
                if (count($parts) < 2) {
                    return response()->json(['message' => 'Invalid token format'], 401);
                }
                $header = json_decode(base64_decode(strtr($parts[0], '-_', '+/')), true);
                if (!isset($header['kid'])) {
                    return response()->json(['message' => 'Invalid token header'], 401);
                }
                $kid = $header['kid'];

                // Parse JWKS to get an array of public keys
                $publicKeys = JWK::parseKeySet($jwks, 'RS256');
                if (!isset($publicKeys[$kid])) {
                    return response()->json(['message' => 'Public key not found for token'], 401);
                }
                $publicKey = $publicKeys[$kid];

                // Decode and verify the JWT.
                // (Optionally, add more validation such as issuer and audience checks.)
                $headersForDecode = new stdClass();
                $decoded = JWT::decode($accessToken, $publicKey, $headersForDecode);
                // Convert the decoded token (an object) to an associative array
                $facebookData = json_decode(json_encode($decoded), true);
            } else {
                // For classic login, use the Graph API
                $fields = 'id,name,email,picture.type(large)';
                $response = Http::get('https://graph.facebook.com/me', [
                    'fields' => $fields,
                    'access_token' => $accessToken,
                ]);

                if ($response->failed()) {
                    error_log('Facebook API request failed: ' . $response->body());
                    return response()->json(['message' => 'Invalid or expired access token'], 401);
                }
                $facebookData = $response->json();
            }

            // Ensure email is provided
            if (empty($facebookData['email'])) {
                return response()->json(['message' => 'Email not provided by Facebook'], 401);
            }

            $email = $facebookData['email'];
            // For limited login, the user ID is typically in the 'sub' claim; otherwise, it's 'id'
            $facebookId = $isLimitedLogin ? ($facebookData['sub'] ?? null) : ($facebookData['id'] ?? null);
            if (!$facebookId) {
                return response()->json(['message' => 'Facebook ID not found'], 401);
            }
            // For limited login, name might not be provided
            $name = $facebookData['name'] ?? '';
            $profilePicture = $isLimitedLogin ? null : ($facebookData['picture']['data']['url'] ?? null);

            // Look up or create the user
            $user = User::where('email', $email)->first();

            if (!$user) {
                $user = User::create([
                    'name' => $name,
                    'email' => $email,
                    'facebook_id' => $facebookId,
                    'profile_picture' => $profilePicture,
                    'password' => Hash::make(uniqid()),
                ]);

                event(new Registered($user));
            } else {
                if (is_null($user->facebook_id)) {
                    $user->update(['facebook_id' => $facebookId]);
                }
                if (!$isLimitedLogin && ($name || $profilePicture)) {
                    $updateData = [];
                    if ($name && empty($user->name)) {
                        $updateData['name'] = $name;
                    }
                    if ($profilePicture) {
                        $updateData['profile_picture'] = $profilePicture;
                    }
                    if (!empty($updateData)) {
                        $user->update($updateData);
                    }
                }
            }

            return response()->json([
                'token' => $user->createToken($user->email)->plainTextToken,
                'user' => $user->toArray(),
                'hadPendingSharedAudios' => $this->attachSharedProducts($user),
            ]);
        } catch (\Exception $e) {
            error_log('Error: ' . $e->getMessage());
            return response()->json(['message' => 'Error validating access token or fetching user data'], 500);
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

            event(new Registered($user));
        } else {
            if (is_null($user->apple_id)) {
                $user->update(['apple_id' => $appleId]);
            }
        }

        return new Response([
            'token' => $user->createToken($user->email)->plainTextToken,
            'user' => $user->toArray(),
            'hadPendingSharedAudios' => $this->attachSharedProducts($user),
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
    
            event(new Registered($user));
        } else {
            if (is_null($user->google_id)) {
                $user->update(['google_id' => $googleData['sub']]);
            }
        }
    
        return new Response([
            'token' => $user->createToken($user->email)->plainTextToken,
            'user' => $user->toArray(),
            'hadPendingSharedAudios' => $this->attachSharedProducts($user),
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

        event(new RegisteredUser($user));

        return new Response([
            'token' => $user->createToken($request->email)->plainTextToken,
            'user' => $user->toArray(),
            'hadPendingSharedAudios' => $this->attachSharedProducts($user),
        ]);
    }

    private function attachSharedProducts($user) {
        $pendingShares = PendingShareDestination::where('email', $user->email)->get();
        $hadPending = false;
        
        foreach ($pendingShares as $pendingShare) {
            $user->products()->attach($pendingShare->product_id);
            $pendingShare->delete();
            $hadPending = true;
        }

        return $hadPending;
    }
}
