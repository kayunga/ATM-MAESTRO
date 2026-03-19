<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'admin@techmasters.zm'],
            [
                'name'     => 'Admin',
                'email'    => 'admin@techmasters.zm',
                'password' => Hash::make('admin123'),
                'is_admin' => true,
            ]
        );

        $this->command->info('✓ Admin user created:');
        $this->command->info('  Email:    admin@techmasters.zm');
        $this->command->info('  Password: admin123');
        $this->command->info('  ⚠  Change this password after first login!');
    }
}
