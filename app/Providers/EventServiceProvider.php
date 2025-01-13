<?php

namespace App\Providers;

use App\Events\RegisteredUser;
use App\Listeners\SendVerifyEmailAddressEmail;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider
{
    /**
     * The event to listener mappings for the application.
     */
    protected $listen = [
        RegisteredUser::class => [
            SendVerifyEmailAddressEmail::class,
        ],
    ];

    /**
     * Register any events for your application.
     */
    public function boot(): void
    {
        //
    }
}
