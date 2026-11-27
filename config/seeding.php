<?php

/*
|--------------------------------------------------------------------------
| Seeder settings
|--------------------------------------------------------------------------
|
| TEMPORARY: the initial passwords are hardcoded below. They are only used
| when seeding; users created later in the web app choose their own.
| Set SEED_ADMIN_PASSWORD / SEED_ENGINEER_PASSWORD in the environment to
| override them (recommended before real production use).
|
*/

return [
    'admin_password' => env('SEED_ADMIN_PASSWORD') ?: 'admin@123',
    'engineer_password' => env('SEED_ENGINEER_PASSWORD') ?: 'test@1234',

    // TechmastersSeeder wipes banks, ATMs, engineers, calls and job cards.
    // It refuses to run over existing job cards unless this is true.
    'allow_reset' => (bool) env('SEED_ALLOW_RESET', false),
];
