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
