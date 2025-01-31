<?php

namespace App\Services;

use SendGrid;
use SendGrid\Mail\Mail;

class SendGridService
{
    protected $sendGrid;

    const VerifyEmailTemplate = "d-fdcb613fe99048c8ba71b830fddb43ca";
    const AudioSharedWithYouTemplate = "d-a55d3409f06448acaa4c94a53e2e6446";

    public function __construct()
    {
        $this->sendGrid = new SendGrid(env('SENDGRID_API_KEY'));
    }

    public function send($to, $templateId, $dynamicData, $from = null)
    {
        $email = new Mail();
        $email->setFrom($from ?? env('MAIL_FROM_ADDRESS'), env('MAIL_FROM_NAME'));
        $email->addTo($to);
        $email->setTemplateId($templateId);
        $email->addDynamicTemplateDatas($dynamicData);

        try {
            $response = $this->sendGrid->send($email);
            return [
                'status' => $response->statusCode(),
                'body' => $response->body(),
                'headers' => $response->headers(),
            ];
        } catch (\Exception $e) {
            return [
                'error' => $e->getMessage(),
            ];
        }
    }
}
