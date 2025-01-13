<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

class EmailVerificationController extends Controller
{
    public function verify(Request $request, $id, $hash)
    {
        if (!$request->hasValidSignature()) {
            abort(403, 'Invalid or expired link.');
        }

        $user = User::findOrFail($id);

        if (!hash_equals($hash, sha1($user->getEmailForVerification()))) {
            abort(403, 'Invalid link.');
        }

        if (!$user->hasVerifiedEmail()) {
            $user->forceFill([
                'email_verified_at' => now(),
            ])->save();
        }

        return response('Your email has been successfully verified.');
    }
}
