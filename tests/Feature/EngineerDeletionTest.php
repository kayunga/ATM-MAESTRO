<?php

use App\Models\Atm;
use App\Models\Bank;
use App\Models\Call;
use App\Models\Engineer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('deletes an engineer login while preserving assigned calls and clearing user references', function () {
    $admin = User::factory()->create(['is_admin' => true]);
    $login = User::factory()->create();
    $engineer = Engineer::create([
        'user_id' => $login->id,
        'name' => 'Test Engineer',
        'region' => 'Central',
    ]);
    $bank = Bank::create(['name' => 'Example Bank', 'short_code' => 'EX']);
    $atm = Atm::create([
        'terminal_id' => 'ATM-100',
        'model' => 'NCR 6684',
        'location' => 'Lusaka',
        'bank_id' => $bank->id,
        'engineer_id' => $engineer->id,
    ]);
    $call = Call::create([
        'atm_id' => $atm->id,
        'assigned_engineer_id' => $engineer->id,
        'assigned_by' => $login->id,
        'call_type' => 'new',
        'status' => 'assigned',
        'priority' => 'medium',
        'fault_description' => 'ATM is not responding',
    ]);
    $login->createToken('mobile');

    $this->actingAs($admin)
        ->delete("/engineers/{$engineer->id}")
        ->assertRedirect();

    expect(User::find($login->id))->toBeNull()
        ->and($login->tokens()->count())->toBe(0)
        ->and($engineer->fresh()->user_id)->toBeNull()
        ->and($engineer->fresh()->trashed())->toBeTrue()
        ->and($call->fresh()->assigned_by)->toBeNull()
        ->and($call->fresh()->assigned_engineer_id)->toBe($engineer->id);
});
