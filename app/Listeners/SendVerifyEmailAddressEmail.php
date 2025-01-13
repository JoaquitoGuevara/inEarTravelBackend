<?php

namespace App\Listeners;

use App\Events\RegisteredUser;
use App\Services\SendGridService;
use Illuminate\Contracts\Queue\ShouldQueue;
use URL;

class SendVerifyEmailAddressEmail implements ShouldQueue
{
    private SendGridService $sendGrid;

    public function __construct(SendGridService $sendGrid) {
        $this->sendGrid = $sendGrid;
    }
    /**
     * Handle the event.
     */
    public function handle(RegisteredUser $event): void
    {
        $user = $event->user;

        $verificationLink = URL::temporarySignedRoute(
            'email.verify',
            now()->addHours(24),
            [
                'id'   => $user->id,
                'hash' => sha1($user->getEmailForVerification()),
            ]
        );

        $this->sendGrid->send($user->email, SendGridService::VerifyEmailTemplate, [
            "name" => $user->name,
            "verificationLink" => $verificationLink,
        ]);
    }
}
