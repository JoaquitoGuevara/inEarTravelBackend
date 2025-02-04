<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;
use YieldStudio\LaravelExpoNotifier\ExpoNotificationsChannel;
use YieldStudio\LaravelExpoNotifier\Dto\ExpoMessage;

class AudioSharedWithYouPushNotification extends Notification
{
    public function via($notifiable): array
    {
        return [ExpoNotificationsChannel::class];
    }

    public function __construct(
        private string $title,
        private string $body,
    ) {}

    public function toExpoNotification($notifiable): ExpoMessage
    {
        if (!$notifiable->expo_push_token)
            return new ExpoMessage();

        return (new ExpoMessage())
            ->to([$notifiable->expo_push_token])
            ->title($this->title)
            ->body($this->body)
            ->jsonData([ "screen" => "myAudios" ])
            ->channelId('default');
    }
}