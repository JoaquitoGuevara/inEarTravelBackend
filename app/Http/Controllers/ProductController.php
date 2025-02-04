<?php

namespace App\Http\Controllers;

use App\Models\PendingShareDestination;
use App\Models\Product;
use App\Notifications\AudioSharedWithYouPushNotification;
use App\Services\SendGridService;
use Illuminate\Http\Request;
use App\Models\User;

class ProductController extends Controller
{
    private SendGridService $sendGrid;

    public function __construct(SendGridService $sendGrid) {
        $this->sendGrid = $sendGrid;
    }

    public function isOwnedByExistingUser(Request $request, Product $product) {
        $request->validate([
            "email" => "required|email",
        ]);

        $user = User::where('email', operator: $request->email)->first();

        $existingPendingShare = PendingShareDestination::where('product_id', $product->id)
            ->where('email', $request->email)
            ->first();

        $owned = $user ? $user->products()->where('products.id', $product->id)->exists() : false;
        $owned = $existingPendingShare ? true : $owned;

        return response()->json([
            'owned' => $owned
        ], 200);
    }

    public function share(Request $request, Product $product) {
        $request->validate([
            "email" => "required|email",
        ]);

        $user = $request->user();
        $destinationUser = User::where('email', $request->email)->first();

        $productWithPivot = $user->products()->wherePivot('product_id', $product->id)->withPivot('timesShared')->first();

        if (!$productWithPivot) 
            return response()->json(['message' => 'Audio not found'], 404);
        
        if ($productWithPivot->pivot->timesShared > 0)
            return response()->json(['message' => 'You’ve already shared the audio once for free. To share it with more users, you can do so at a discounted price'], 400);

        if ($destinationUser) {
            if ($destinationUser->products()->where('product_id', $product->id)->exists()) 
                return response()->json(['message' => 'This user already has access to this audio guide'], 400);

            $destinationUser->products()->syncWithoutDetaching([
                $product->id => [
                    'audioFile' => $productWithPivot->pivot->audioFile || $product->audioFile
                ]
            ]);
            $user->products()->updateExistingPivot($product->id, [
                'timesShared' => $productWithPivot->pivot->timesShared + 1
            ]);

            $response = $this->sendGrid->send($request->email, SendGridService::AudioSharedWithYouTemplate, [
                "name" => $user->name,
                "audioTitle" => $product->name,
                "audioDescription" => $product->description,
                "audioPhoto" => $product->photo,
            ]);
            error_log(json_encode($response));
            $destinationUser->notify(new AudioSharedWithYouPushNotification(
                "Someone shared you an audio guide",
                $user->name . " shared you " . $product->name,
            ));
           
            return response()->json(['message' => 'Audio shared successfully']);
        }

        $existingPendingShare = PendingShareDestination::where('product_id', $product->id)
            ->where('email', $request->email)
            ->first();

        if ($existingPendingShare) 
            return response()->json(['message' => 'This email already has a pending share invitation for this audio guide'], 400);

        PendingShareDestination::create([
            'product_id' => $product->id,
            'email' => $request->email
        ]);

        $user->products()->updateExistingPivot($product->id, [
            'timesShared' => $productWithPivot->pivot->timesShared + 1
        ]);

        $response = $this->sendGrid->send($request->email, SendGridService::AudioSharedWithNonUserTemplate, [
            "name" => $user->name,
            "audioTitle" => $product->name,
            "audioDescription" => $product->description,
            "audioPhoto" => $product->photo,
        ]);
        error_log(json_encode($response));

        return response()->json(['message' => 'An invitation to sign up has been sent to the email address provided']);
    }   
    
    public function index()    {
        $products = Product::all();

        return response()->json(['products' => $products]);
    }

    public function getForUser(Request $request) {
        $user = $request->user();

        $audios = $user->products()->with('timestamps')->get()->toArray();

        foreach ($audios as &$audio) {
            $audioFile = $audio['pivot']['audioFile'];
            $audio['timestamps'] = array_values(array_filter($audio['timestamps'], function($timestamp) use ($audioFile) {
                return $timestamp['forAudioFile'] === $audioFile;
            }));
        }

        return response()->json(['audios' => $audios]);
    }

    public function validateCoupon(Request $request) {
        $request->validate([
            "code" => "required",
        ]);

        $code = $request->query("code");

        if ($code === "KAYTOURSMEXICO")
            return response()->json(['newPrice' => 1.99, 'newIapProductId' => 'ktmchichenitzaaudioguide']);
        else if ($code === "LIVINGDREAMS")
            return response()->json(['newPrice' => 1.99, 'newIapProductId' => 'ldmchichenitzaaudioguide']);

        return response()->json([
            'status' => 'error',
            'message' => 'The code is not valid'
        ], 404);
    }
}
