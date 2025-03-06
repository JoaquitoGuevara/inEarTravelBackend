<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Services\IAPService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AudioDownloadController extends Controller
{
    public function getPresignedUrlForAudioForGuest(Request $request, string $id, IAPService $iapService)
    {
        $request->validate([
            'packageName'   => 'required|string',
            'productId' => 'required|string',
            'transactionReceipt' => 'string',
            'transactionId' => 'integer',
        ]);

        $packageName = $request->input('packageName');
        $productId = $request->input('productId');
        $transactionReceipt = $request->input('transactionReceipt');
        $transactionId = $request->input('transactionId');

        $verification = $iapService->verifyPurchase($packageName, $productId, null, $transactionReceipt, $transactionId);

        if ($verification !== true)
            return $verification;

        $safeProductId = preg_match('/^(ldm|ktm)(.*)/', $productId, $matches) ? $matches[2] : $productId;
        $product = Product::where('iapProductId', $safeProductId)->with('timestamps')->first();

        $audioFile = $product->audioFile;

        if ($productId === "ldmchichenitzaaudioguide") 
            $audioFile = "LDM_AUDIO_GUIA_MASTER.mp3";
        else if ($productId === "ktmchichenitzaaudioguide")
            $audioFile = "KTM_AUDIO_GUIA_MASTER.mp3";

        $signedUrl = self::generatePresignedUrl($audioFile, 10);

        return response()->json([
            'signedUrl' => $signedUrl,
        ]);
    }

    public function getPresignedUrlForAudio(Request $request, string $id)
    {
        $user = $request->user();

        $product = $user->products()->where('products.id', $id === '1000000' ? 2 : $id)->first();

        if (!$product) {
            return response()->json(['error' => 'Unauthorized access to this audio'], 403);
        }

        $audioFile = $product->pivot->audioFile ?? $product->audioFile;

        if ($user->is_guide && $id === '2') 
            $audioFile = 'LDM_AUDIO_GUIA_MASTER.mp3';
        else if ($user->is_guide && $id === '1000000')
            $audioFile = 'KTM_AUDIO_GUIA_MASTER.mp3';

        $signedUrl = self::generatePresignedUrl($audioFile, 10);

        return response()->json([
            'signedUrl' => $signedUrl,
        ]);
    }

    public function getPresignedUrlForSampleAudio(Request $request, string $id)
    {
        $product = Product::find($id);

        $signedUrl = self::generatePresignedUrl($product->sampleAudioFile, 10);

        return response()->json([
            'signedUrl' => $signedUrl,
        ]);
    }

    function generatePresignedUrl($filePath, $expirationMinutes) {
        $disk = Storage::disk('s3');

        if (!$disk->exists($filePath)) {
            throw new \Exception('File does not exist on S3.');
        }

        return $disk->temporaryUrl(
            $filePath,
            now()->addMinutes($expirationMinutes)
        );
    }
}
