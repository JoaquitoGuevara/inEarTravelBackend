<?php

namespace App\Http\Controllers;

use App\Models\PendingShareDestination;
use App\Models\Product;
use App\Models\User;
use App\Notifications\AudioSharedWithYouPushNotification;
use App\Services\SendGridService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use App\Services\GooglePlayTokenService;
use Exception;
use Illuminate\Support\Facades\Log;

class InAppPurchaseController extends Controller
{
    private SendGridService $sendGrid;

    public function __construct(SendGridService $sendGrid) {
        $this->sendGrid = $sendGrid;
    }
    public function verifyIapForShare(Request $request) {
        $request->validate([
            'packageName'   => 'required|string',
            'productId'     => 'required|string',
            'purchaseToken' => 'string',
            'transactionReceipt' => 'string',
            'transactionId' => 'integer',
            'destinationEmail' => 'required|email',
        ]);

        $packageName = $request->input('packageName');
        $productId = $request->input('productId');
        $purchaseToken = $request->input('purchaseToken');
        $transactionReceipt = $request->input('transactionReceipt');
        $transactionId = $request->input('transactionId');
        $destinationEmail = $request->input('destinationEmail');


        if (!str_starts_with($productId, 'forshare')) {
            return response()->json([
                'status' => 'error',
                'message' => 'Invalid product ID for sharing. Missing required prefix'
            ], 400);
        }

        $verification = $this->verifyPurchase($packageName, $productId, $purchaseToken, $transactionReceipt, $transactionId);

        if ($verification !== true)
            return $verification;

        $normalizedProductId = substr($productId, strlen('forshare'));

        $user = $request->user();

        $product = $user->products()
                ->where('iapProductId', $normalizedProductId)
                ->first();

        if (!$product) {
            return response()->json([
                'status' => 'error',
                'message' => 'We couldn\'t find a product associated with this product id. Please contact support'
            ], 404);
        }

        $audioFile = $product->pivot->audioFile ?: null;

        $destinationUser = User::where('email', $destinationEmail)->first();

        if ($destinationUser) { 
            $destinationUserProducts = $destinationUser->products();
            if ($destinationUserProducts->where('products.id', $product->id)->exists()) {
                return response()->json([
                    'message' => 'The audio guide was given to the user successfully but the user already had access to it previously',
                ]);
            }

            $destinationUserProducts->syncWithoutDetaching([
                $product->id => [
                    'audioFile' => $audioFile
                ]
            ]);
            $user->products()->updateExistingPivot($product->id, [
                'timesShared' => $product->pivot->timesShared + 1
            ]);

            $this->sendGrid->send($request->email, SendGridService::AudioSharedWithYouTemplate, [
                "name" => $user->name,
                "audioTitle" => $product->name,
                "audioDescription" => $product->description,
                "audioPhoto" => $product->photo,
            ]);
            $destinationUser->notify(new AudioSharedWithYouPushNotification(
                "Someone shared you an audio guide",
                $user->name . " shared you " . $product->name,
            ));

            return response()->json([
                'status' => 'success',
                'message' => 'The user now has this audio guide in their library',
            ]);
        }

        $existingPendingShare = PendingShareDestination::where('product_id', $product->id)
            ->where('email', $destinationEmail)
            ->first();

        if ($existingPendingShare) 
            return response()->json(['message' => 'This email already has a pending share invitation for this audio guide'], 400);

        PendingShareDestination::create([
            'product_id' => $product->id,
            'email' => $destinationEmail
        ]);

        $user->products()->updateExistingPivot($product->id, [
            'timesShared' => $product->pivot->timesShared + 1
        ]);

        $this->sendGrid->send($destinationEmail, SendGridService::AudioSharedWithNonUserTemplate, [
            "name" => $user->name,
            "audioTitle" => $product->name,
            "audioDescription" => $product->description,
            "audioPhoto" => $product->photo,
        ]);

        return response()->json(['message' => 'An invitation to sign up has been sent to the email address provided']);
    }

    public function verifyIap(Request $request) {
        $request->validate([
            'packageName'   => 'required|string',
            'productId'     => 'required|string',
            'purchaseToken' => 'string',
            'transactionReceipt' => 'string',
            'transactionId' => 'integer',
        ]);

        $packageName = $request->input('packageName');
        $productId = $request->input('productId');
        $purchaseToken = $request->input('purchaseToken');
        $transactionReceipt = $request->input('transactionReceipt');
        $transactionId = $request->input('transactionId');

        $verification = $this->verifyPurchase($packageName, $productId, $purchaseToken, $transactionReceipt, $transactionId);

        if ($verification !== true)
            return $verification;

        $user = $request->user();

        $safeProductId = preg_match('/^(ldm|ktm)(.*)/', $productId, $matches) ? $matches[2] : $productId;
        $product = Product::where('iapProductId', $safeProductId)->first();

        if (!$product) {
            return response()->json([
                'status' => 'error',
                'message' => 'We couldn\'t find a product associated with this product id. Please contact support'
            ], 404);
        }

        $alternativeAudioFile = null;

        if ($productId === "ldmchichenitzaaudioguide")
            $alternativeAudioFile = "LDM_AUDIO_GUIA_MASTER.mp3";
        else if ($productId === "ktmchichenitzaaudioguide")
            $alternativeAudioFile = "KTM_AUDIO_GUIA_MASTER.mp3";

        $user->products()->syncWithoutDetaching([
            $product->id => [
                'audioFile' => $alternativeAudioFile
            ]
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Your new audio can now be found in the My Audios tab',
        ]);
    }

    private function verifyPurchase(string $packageName, string $productId, string|null $purchaseToken, string|null $transactionReceipt, int|null $transactionId) {
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

                error_log($response);

                if ($response['status'] === 0) {
                    if ($transactionId)
                        $validatedProductId = collect($response['receipt']['in_app'])->firstWhere('transaction_id', $transactionId)['product_id'] ?? null;
                    else 
                        $validatedProductId = $response['receipt']['in_app'][count($response['receipt']['in_app']) - 1]['product_id'] ?? null;
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
