<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    /**
     * Display a listing of the resource.
     */
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
