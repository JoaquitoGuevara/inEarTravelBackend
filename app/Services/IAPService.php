<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use App\Services\GooglePlayTokenService;
use Exception;
use Illuminate\Support\Facades\Log;

class IAPService
{
    public function verifyPurchase(string $packageName, string $productId, string|null $purchaseToken, string|null $transactionReceipt, int|null $transactionId) {
        if (!$purchaseToken && !$transactionReceipt) {
            return response()->json([ 
                'status' => 'error',
                'message' => 'Either a purchase token or transaction receipt has to be sent.'
            ], 422);
        }

        $validatedProductId = null;

        try {
            if ($purchaseToken) {
                $accessToken = GooglePlayTokenService::getGoogleAccessToken();

                $url = sprintf(
                    'https://www.googleapis.com/androidpublisher/v3/applications/%s/purchases/products/%s/tokens/%s',
                    $packageName,
                    $productId,
                    $purchaseToken
                );

                $response = Http::withToken($accessToken)->get($url);

                if (!$response->successful()) {
                    return response()->json([
                        'status'          => 'error',
                        'message'         => 'Failed to verify purchase with Google. Google\'s servers are unavailable right now.',
                        'google_response' => $response->json(),
                    ], $response->status());
                }

                $data = $response->json();

                // purchaseState codes for non-subscription:
                //   0 = Purchased
                //   1 = Canceled
                //   2 = Pending
                if (isset($data['purchaseState']) && $data['purchaseState'] !== 0) {
                    return response()->json([
                        'status'  => 'error',
                        'message' => 'The requested item is not purchased.',
                        'data'    => $data,
                    ], 400);
                }

                Log::info('Android IAP Verification data:', ['data' => $data]);
                $validatedProductId = $productId;
            }
            else {
                $productionEndpoint = 'https://buy.itunes.apple.com/verifyReceipt';
                $sandboxEndpoint    = 'https://sandbox.itunes.apple.com/verifyReceipt';

                $verifyUrl = $productionEndpoint;

                $postBody = [
                    'receipt-data' => $transactionReceipt,
                    'exclude-old-transactions' => true,
                ];

                $response = Http::post($verifyUrl, $postBody);

                if (!$response->successful()) {
                    return response()->json([
                        'status'          => 'error',
                        'message'         => 'Failed to verify purchase with Apple. Apple\'s servers are unavailable right now.',
                        'apple_response' => $response->json(),
                    ], $response->status());
                }

                if (isset($response['status']) && $response['status'] === 21007) {
                    $verifyUrl = $sandboxEndpoint;
                    $response = Http::post($verifyUrl, $postBody);
                }
                if (!isset($response['status'])) {
                    return response()->json([
                        'status'  => 'error',
                        'message' => 'Malformed response from Apple.',
                    ], 500);
                }

                if ($response['status'] === 0) {
                    $validatedProductId = $productId;
                    //if ($transactionId)
                    //    $validatedProductId = collect($response['receipt']['in_app'])->firstWhere('transaction_id', $transactionId)['product_id'] ?? null;
                    //else 
                    //    $validatedProductId = $response['receipt']['in_app'][count($response['receipt']['in_app']) - 1]['product_id'] ?? null;
                } else {
                    return response()->json([
                        'status'  => 'error',
                        'message' => 'The requested item is not purchased',
                        'apple_status_code' => $response['status'],
                    ], 400);
                }
            }
        } catch (Exception $e) {
            Log::error('Exception verifying IAP', ['exception' => $e]);
            return response()->json([
                'status'  => 'error',
                'message' => $e->getMessage(),
            ], status: 500);
        }

        if ($validatedProductId === null) {
            return response()->json([
                'status' => 'error',
                'message' => 'There is no matching product id',
            ], 400);
        }
        if ($validatedProductId !== $productId) {
            return response()->json([
                'status' => 'error',
                'message' => 'There is a mismatch between the validated product id and the requested product id',
                'validatedProductId' => $validatedProductId,
            ], 400);
        }

        return true;
    }
}
