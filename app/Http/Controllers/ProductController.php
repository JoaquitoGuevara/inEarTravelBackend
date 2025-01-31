<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;
use App\Models\User;

class ProductController extends Controller
{
    public function share(Request $request, Product $product) {
        $request->validate([
            "email" => "required|email",
        ]);

        $user = $request->user();
        $destinationUser = User::where('email', $request->email)->first();
        
        if ($destinationUser) {
            $productWithPivot = $user->products()->wherePivot('product_id', $product->id)->withPivot('timesShared')->first();

            if (!$productWithPivot) 
                return response()->json(['message' => 'Audio not found'], 404);
            
            if ($productWithPivot->pivot->timesShared > 0)
                return response()->json(['message' => 'Audio already shared once'], 400);

            $user->products()->updateExistingPivot($product->id, [
                'timesShared' => $productWithPivot->pivot->timesShared + 1
            ]);
            $destinationUser->products()->attach($product->id);
           
            return response()->json(['message' => 'Audio shared successfully']);
        }
    }
    public function index()
    {
        $products = Product::all();

        return response()->json(['products' => $products]);
    }

    public function getForUser(Request $request) {
        $user = $request->user();

        $audios = $user->products()->with('timestamps')->get();

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
