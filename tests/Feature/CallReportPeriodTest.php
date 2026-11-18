<?php

use App\Models\Atm;
use App\Models\Bank;
use App\Models\Call;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('keeps unresolved calls in date-bounded reports until they are resolved', function () {
    $admin = User::factory()->create(['is_admin' => true]);
    $bank = Bank::create(['name' => 'Example Bank', 'short_code' => 'EX']);
    $atm = Atm::create([
        'terminal_id' => 'ATM-100',
        'model' => 'NCR 6684',
        'location' => 'Lusaka',
        'bank_id' => $bank->id,
    ]);

    $createCall = function (string $status, \Carbon\CarbonInterface $createdAt) use ($atm): Call {
        $call = new Call([
            'atm_id' => $atm->id,
            'call_type' => 'old',
            'status' => $status,
            'priority' => 'medium',
            'fault_description' => 'Test report call',
        ]);
        $call->created_at = $createdAt;
        $call->updated_at = $createdAt;
        $call->save();

        return $call;
    };

    $openCall = $createCall('pending', now()->subDays(3));
    $escalatedCall = $createCall('escalated', now()->subDays(2));
    $resolvedCall = $createCall('resolved', now()->subDays(1));
    $todayCall = $createCall('resolved', now());

    $this->actingAs($admin)
        ->getJson('/calls?status=all&date_from='.now()->toDateString().'&date_to='.now()->toDateString())
        ->assertOk()
        ->assertJsonCount(3)
        ->assertJsonFragment(['id' => $openCall->id])
        ->assertJsonFragment(['id' => $escalatedCall->id])
        ->assertJsonFragment(['id' => $todayCall->id])
        ->assertJsonMissing(['id' => $resolvedCall->id]);
});

it('returns the unresolved call count in the dashboard summary', function () {
    $admin = User::factory()->create(['is_admin' => true]);
    $bank = Bank::create(['name' => 'Example Bank', 'short_code' => 'EX']);
    $atm = Atm::create([
        'terminal_id' => 'ATM-100',
        'model' => 'NCR 6684',
        'location' => 'Lusaka',
        'bank_id' => $bank->id,
    ]);

    foreach (['pending', 'assigned', 'on_hold', 'escalated', 'resolved'] as $status) {
        Call::create([
            'atm_id' => $atm->id,
            'call_type' => 'old',
            'status' => $status,
            'priority' => 'medium',
            'fault_description' => 'Test summary call',
        ]);
    }

    $this->actingAs($admin)
        ->getJson('/calls?summary=1')
        ->assertOk()
        ->assertJson([
            'pending' => 1,
            'unresolved' => 4,
        ]);
});

it('defaults the calls list to pending calls', function () {
    $admin = User::factory()->create(['is_admin' => true]);
    $bank = Bank::create(['name' => 'Example Bank', 'short_code' => 'EX']);
    $atm = Atm::create([
        'terminal_id' => 'ATM-100',
        'model' => 'NCR 6684',
        'location' => 'Lusaka',
        'bank_id' => $bank->id,
    ]);

    $pendingCall = Call::create([
        'atm_id' => $atm->id,
        'call_type' => 'old',
        'status' => 'pending',
        'priority' => 'medium',
        'fault_description' => 'Pending test call',
    ]);
    $resolvedCall = Call::create([
        'atm_id' => $atm->id,
        'call_type' => 'old',
        'status' => 'resolved',
        'priority' => 'medium',
        'fault_description' => 'Resolved test call',
    ]);

    $this->actingAs($admin)
        ->getJson('/calls')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonFragment(['id' => $pendingCall->id])
        ->assertJsonMissing(['id' => $resolvedCall->id]);
});

it('paginates calls when a page size is requested', function () {
    $admin = User::factory()->create(['is_admin' => true]);
    $bank = Bank::create(['name' => 'Example Bank', 'short_code' => 'EX']);
    $atm = Atm::create([
        'terminal_id' => 'ATM-100',
        'model' => 'NCR 6684',
        'location' => 'Lusaka',
        'bank_id' => $bank->id,
    ]);

    foreach (range(1, 26) as $number) {
        Call::create([
            'atm_id' => $atm->id,
            'call_type' => 'old',
            'status' => 'pending',
            'priority' => 'medium',
            'fault_description' => "Test paginated call {$number}",
        ]);
    }

    $this->actingAs($admin)
        ->getJson('/calls?per_page=10&page=2')
        ->assertOk()
        ->assertJsonPath('current_page', 2)
        ->assertJsonPath('last_page', 3)
        ->assertJsonPath('total', 26)
        ->assertJsonCount(10, 'data');
});
