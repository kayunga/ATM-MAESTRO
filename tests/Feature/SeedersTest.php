<?php

use App\Models\Engineer;
use App\Models\JobCard;
use App\Models\User;
use Database\Seeders\AdminUserSeeder;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\TechmastersSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

beforeEach(function () {
    config(['seeding.allow_reset' => false]);
});

it('seeds accounts with the default passwords', function () {
    $this->seed(DatabaseSeeder::class);

    $admin = User::where('email', 'admin@techmasters.zm')->first();
    $engineer = User::where('email', 'philip@techmasters.zm')->first();

    expect($admin->is_admin)->toBeTrue()
        ->and(Hash::check('admin@123', $admin->password))->toBeTrue()
        ->and(Hash::check('test@1234', $engineer->password))->toBeTrue()
        ->and(Engineer::count())->toBeGreaterThan(0);
});

it('removes the retired early-access admin account', function () {
    User::factory()->create(['email' => 'early-access-admin@example.com', 'is_admin' => true]);

    $this->seed(AdminUserSeeder::class);

    expect(User::where('email', 'early-access-admin@example.com')->exists())->toBeFalse();
});

it('uses the SEED_* override when one is configured', function () {
    config(['seeding.admin_password' => 'custom-admin-pass']);

    $this->seed(AdminUserSeeder::class);

    $admin = User::where('email', 'admin@techmasters.zm')->first();
    expect(Hash::check('custom-admin-pass', $admin->password))->toBeTrue();
});

it('will not wipe existing job cards unless reset is allowed', function () {
    $this->seed(DatabaseSeeder::class);
    $atm = App\Models\Atm::first();
    $engineer = Engineer::first();
    DB::table('job_cards')->insert([
        'atm_id' => $atm->id, 'engineer_id' => $engineer->id, 'status' => 'draft',
        'type' => 'Quarterly PM', 'work_description' => 'x', 'hours_spent' => 1,
        'scheduled_date' => now(), 'quarter' => 4, 'year' => 2026,
        'created_at' => now(), 'updated_at' => now(),
    ]);

    expect(fn () => $this->seed(TechmastersSeeder::class))->toThrow(RuntimeException::class);
    expect(JobCard::count())->toBe(1);
});
