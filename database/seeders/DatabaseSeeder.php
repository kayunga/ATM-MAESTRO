<?php
// database/seeders/DatabaseSeeder.php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the real application data: the admin account, then banks,
     * engineers, ATMs and calls, then the scheduled PM records.
     *
     * Requires SEED_ADMIN_PASSWORD and SEED_ENGINEER_PASSWORD.
     */
    public function run(): void
    {
        $this->call([
            AdminUserSeeder::class,
            TechmastersSeeder::class,
            MaintenanceSeeder::class,
        ]);
    }
}
