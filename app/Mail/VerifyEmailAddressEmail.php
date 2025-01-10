<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class VerifyEmailAddressEmail extends Mailable
{
    use Queueable, SerializesModels;

    private $verificationLink;

    public function __construct(string $verificationLink)
    {
        $this->verificationLink = $verificationLink;
    }
    
    /**
     * Build the message.
     */
    public function build()
    {
        return $this
            ->from(env('MAIL_FROM_ADDRESS'), env('MAIL_FROM_NAME'))
            ->subject('Please verify your email address')
            ->view('emails.verifyemail', [
                'verificationLink' => $this->verificationLink
            ]);
    }
}
