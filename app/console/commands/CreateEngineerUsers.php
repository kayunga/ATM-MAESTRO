<?php

namespace App\Console\Commands;

use App\Models\Engineer;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class CreateEngineerUsers extends Command
{
    protected $signature   = 'engineers:create-users';
    protected $description = 'Create user accounts for all engineers that do not have one';

    public function handle()
    {
        $engineers = Engineer::whereNull('user_id')->get();

        if ($engineers->isEmpty()) {
            $this->info('All engineers already have user accounts.');
            return;
        }

        foreach ($engineers as $engineer) {
            $email = $engineer->email
                ?? strtolower(str_replace(' ', '.', $engineer->name)) . '@test.com';

            if (User::where('email', $email)->exists()) {
                $this->warn("Skipping {$engineer->name} — email {$email} already exists.");
                continue;
            }

            $user = User::create([
                'name'     => $engineer->name,
                'email'    => $email,
                'password' => Hash::make('Test@2026'),
            ]);

            $engineer->update(['user_id' => $user->id]);

            $this->info("✓ {$engineer->name} → {$email} (password: Test@2026)");
        }

        $this->info('Done.');
    }
}
