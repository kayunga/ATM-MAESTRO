<?php

namespace Database\Seeders;

use App\Models\User;
use Database\Seeders\Concerns\ReadsSeedPasswords;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    use ReadsSeedPasswords;

    public function run(): void
    {
        $password = $this->seedPassword('admin_password', 'SEED_ADMIN_PASSWORD');

        // Remove the account left behind by the retired early-access seeder.
        User::where('email', 'early-access-admin@example.com')->delete();

        User::updateOrCreate(
            ['email' => 'admin@techmasters.zm'],
            [
                'name'     => 'Admin',
                'password' => Hash::make($password),
                'is_admin' => true,
            ]
        );

        $this->command?->info('✓ Admin user ready: admin@techmasters.zm');
        $this->command?->info('  Password is the value of SEED_ADMIN_PASSWORD.');
    }
}
