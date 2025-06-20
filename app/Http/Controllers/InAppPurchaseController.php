<?php

namespace App\Http\Controllers;

use App\Models\PendingShareDestination;
use App\Models\Product;
use App\Models\User;
use App\Notifications\AudioSharedWithYouPushNotification;
use App\Services\SendGridService;
use Illuminate\Http\Request;
use App\Services\IAPService;

class InAppPurchaseController extends Controller
{
    private SendGridService $sendGrid;

    public function __construct(SendGridService $sendGrid) {
        $this->sendGrid = $sendGrid;
    }
    public function verifyIapForShare(Request $request, IAPService $iapService) {
        $request->validate([
            'packageName'   => 'required|string',
            'productId'     => 'required|string',
            'purchaseToken' => 'string|nullable',
            'transactionReceipt' => 'string|nullable',
            'transactionId' => 'integer|nullable',
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

        $verification = $iapService->verifyPurchase($packageName, $productId, $purchaseToken, $transactionReceipt, $transactionId);

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

    public function verifyIap(Request $request, IAPService $iapService) {
        $request->validate([
            'packageName'   => 'required|string',
            'productId'     => 'required|string',
            'purchaseToken' => 'string|nullable',
            'transactionReceipt' => 'string|nullable',
            'transactionId' => 'integer|nullable',
        ]);

        $packageName = $request->input('packageName');
        $productId = $request->input('productId');
        $purchaseToken = $request->input('purchaseToken');
        $transactionReceipt = $request->input('transactionReceipt');
        $transactionId = $request->input('transactionId');

        $verification = $iapService->verifyPurchase($packageName, $productId, $purchaseToken, $transactionReceipt, $transactionId);

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

    
}
