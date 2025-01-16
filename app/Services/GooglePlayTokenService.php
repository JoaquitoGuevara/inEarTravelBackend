<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Exception;
use Illuminate\Support\Facades\Log;

class GooglePlayTokenService
{
    public static function getGoogleAccessToken(): string
    {
        // 1) Read the path from the env.
        $serviceAccountPath = base_path(env('GOOGLE_SERVICE_ACCOUNT_PATH'));
        Log::info('Resolved service account path: ' . $serviceAccountPath);
        if (!$serviceAccountPath || !file_exists($serviceAccountPath)) {
            throw new Exception('Service account file not found at: ' . $serviceAccountPath);
        }

        // 2) Load and decode the JSON.
        $serviceAccountJson = file_get_contents($serviceAccountPath);
        $serviceAccount = json_decode($serviceAccountJson, true);
        if (!$serviceAccount) {
            throw new Exception('Invalid JSON in service account file at: ' . $serviceAccountPath);
        }

        // 3) Build JWT header & claims.
        $now = time();
        $header = [
            'alg' => 'RS256',
            'typ' => 'JWT',
        ];
        $claims = [
            'iss'   => $serviceAccount['client_email'],                    // service account email
            'scope' => 'https://www.googleapis.com/auth/androidpublisher', // Play Developer API scope
            'aud'   => $serviceAccount['token_uri'],                       // "Audience" is the token endpoint
            'exp'   => $now + 3600, // valid for 1 hour
            'iat'   => $now,        // issued at
        ];

        // 4) Base64Url-encode the header & claims.
        $headerEncoded = self::base64UrlEncode(json_encode($header));
        $claimsEncoded = self::base64UrlEncode(json_encode($claims));
        $signatureBase = $headerEncoded . '.' . $claimsEncoded;

        // 5) Sign with RSA private key from the service account.
        $privateKey = openssl_pkey_get_private($serviceAccount['private_key']);
        if (!$privateKey) {
            throw new Exception('Could not read private key from service account JSON.');
        }

        openssl_sign($signatureBase, $signature, $privateKey, OPENSSL_ALGO_SHA256);
        $signatureEncoded = self::base64UrlEncode($signature);

        // 6) Construct the JWT.
        $jwt = $signatureBase . '.' . $signatureEncoded;

        // 7) Exchange the JWT for an access token.
        // The service account JSON contains "token_uri" = "https://oauth2.googleapis.com/token"
        $response = Http::asForm()->post($serviceAccount['token_uri'], [
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion'  => $jwt,
        ]);

        if (!$response->successful()) {
            throw new Exception('Error fetching access token: ' . $response->body());
        }

        $json = $response->json();
        if (!isset($json['access_token'])) {
            throw new Exception('No access token returned: ' . $response->body());
        }

        return $json['access_token'];
    }

    /**
     * Helper to do base64 URL-encoding (replace +, / and remove =).
     */
    private static function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}
