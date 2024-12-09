<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AudioDownloadController extends Controller
{
    public function getPresignedUrlForAudio(Request $request, string $id)
    {
        $filePath = "LDM_AUDIO_GUIA_MASTER.mp3";

        $signedUrl = self::generatePresignedUrl($filePath, 10);

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
