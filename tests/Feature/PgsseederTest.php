<?php

use App\Models\Atm;
use App\Models\Call;
use App\Models\Engineer;
use App\Models\User;
use Database\Seeders\Pgsseeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

beforeEach(function () {
    config([
        'pgsseeder.admin_password' => 'early-access-admin-password',
        'pgsseeder.engineer_password' => 'early-access-engineer-password',
    ]);
});

it('seeds only the early-access accounts and sample fleet idempotently', function () {
    $existingUser = User::factory()->create(['email' => 'existing@example.com']);

    $seeder = app(Pgsseeder::class);
    $seeder->run();
    $seeder->run();

    expect(User::count())->toBe(5)
        ->and(Engineer::count())->toBe(3)
        ->and(Atm::count())->toBe(3)
        ->and(Call::count())->toBe(3)
        ->and(User::find($existingUser->id))->not->toBeNull()
        ->and(Hash::check(
            'early-access-admin-password',
            User::where('email', 'early-access-admin@example.com')->value('password'),
        ))->toBeTrue();
});

it('requires explicit passwords before seeding accounts', function () {
    config(['pgsseeder.admin_password' => null]);

    expect(fn () => app(Pgsseeder::class)->run())
        ->toThrow(RuntimeException::class, 'Set PGSSEED_ADMIN_PASSWORD');
});
