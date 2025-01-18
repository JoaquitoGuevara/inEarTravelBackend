<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AudioDownloadController extends Controller
{
    public function getPresignedUrlForAudio(Request $request, string $id)
    {
        $user = $request->user();

        $product = Product::find($id);

        if (!$user->products()->where('products.id', $id)->exists()) {
            return response()->json(['error' => 'Unauthorized access to this audio'], 403);
        }

        $signedUrl = self::generatePresignedUrl($product->audioFile, 10);

        return response()->json([
            'signedUrl' => $signedUrl,
        ]);
    }

    public function getPresignedUrlForSampleAudio(Request $request, string $id)
    {
        $user = $request->user();

        $product = Product::find($id);

        if (!$user->products()->where('products.id', $id)->exists()) {
            return response()->json(['error' => 'Unauthorized access to this audio'], 403);
        }

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
