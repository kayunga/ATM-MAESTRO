<?php

use App\Models\Atm;
use App\Models\Bank;
use App\Models\Call;
use App\Models\Engineer;
use App\Models\JobCard;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

it('protects legacy fleet endpoints from unauthenticated and non-admin access', function () {
    $this->getJson('/api/stats')->assertUnauthorized();

    Sanctum::actingAs(User::factory()->create(['is_admin' => false]));

    $this->getJson('/api/stats')->assertForbidden();
});

it('issues separate tokens for multiple mobile devices', function () {
    $user = User::factory()->create(['password' => 'password']);
    Engineer::create([
        'user_id' => $user->id,
        'name' => 'Mobile Engineer',
        'region' => 'Lusaka',
    ]);

    $this->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'password',
        'device_name' => 'phone',
    ])->assertOk()
        ->assertJsonPath('token_type', 'Bearer');

    $this->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'password',
        'device_name' => 'tablet',
    ])->assertOk();

    expect($user->tokens()->count())->toBe(2);
});

it('authenticates mobile engineers regardless of email casing', function () {
    $user = User::factory()->create([
        'email' => 'Engineer@Techmasters.zm',
        'password' => 'password',
    ]);
    Engineer::create([
        'user_id' => $user->id,
        'name' => 'Mobile Engineer',
        'region' => 'Lusaka',
    ]);

    $this->postJson('/api/v1/auth/login', [
        'email' => 'eNGINEER@tECHMASTERS.ZM',
        'password' => 'password',
    ])->assertOk()
        ->assertJsonPath('engineer.email', 'Engineer@Techmasters.zm');
});

it('accepts a mobile JPEG engineer signature data URL', function () {
    $user = User::factory()->create();
    Engineer::create([
        'user_id' => $user->id,
        'name' => 'Mobile Engineer',
        'region' => 'Lusaka',
    ]);
    Sanctum::actingAs($user);

    $signature = 'data:image/jpeg;base64,'.base64_encode('signature image');
    $this->putJson('/api/v1/me/signature', ['signature' => $signature])
        ->assertOk()
        ->assertJsonPath('signature', $signature);
});

it('requires the current password before changing it through the mobile API', function () {
    $user = User::factory()->create(['password' => 'current-password']);
    Engineer::create([
        'user_id' => $user->id,
        'name' => 'Mobile Engineer',
        'region' => 'Lusaka',
    ]);
    Sanctum::actingAs($user);

    $this->putJson('/api/v1/me/password', [
        'current_password' => 'incorrect',
        'password' => 'new-password-123',
        'password_confirmation' => 'new-password-123',
    ])->assertUnprocessable()
        ->assertJsonValidationErrors('current_password');

    $this->putJson('/api/v1/me/password', [
        'current_password' => 'current-password',
        'password' => 'new-password-123',
        'password_confirmation' => 'new-password-123',
    ])->assertOk();

    expect(Hash::check('new-password-123', $user->fresh()->password))->toBeTrue();
});

it('returns paginated ATM data for v1 and keeps the legacy array response', function () {
    $user = User::factory()->create();
    $engineer = Engineer::create([
        'user_id' => $user->id,
        'name' => 'Mobile Engineer',
        'region' => 'Lusaka',
    ]);
    $bank = Bank::create(['name' => 'Example Bank', 'short_code' => 'EX']);
    Atm::create([
        'terminal_id' => 'ATM-100',
        'model' => 'NCR 6684',
        'location' => 'Lusaka',
        'bank_id' => $bank->id,
        'engineer_id' => $engineer->id,
        'status' => 'active',
        'has_gbna' => true,
    ]);

    Sanctum::actingAs($user);

    $this->getJson('/api/v1/engineer/atms?per_page=1')
        ->assertOk()
        ->assertJsonPath('per_page', 1)
        ->assertJsonPath('data.0.has_gbna', true);

    $this->getJson('/api/engineer/atms')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.has_gbna', true);
});

it('includes resolved engineer calls only when requested', function () {
    $user = User::factory()->create();
    $engineer = Engineer::create([
        'user_id' => $user->id,
        'name' => 'Mobile Engineer',
        'region' => 'Lusaka',
    ]);
    $bank = Bank::create(['name' => 'Example Bank', 'short_code' => 'EX']);
    $atm = Atm::create([
        'terminal_id' => 'ATM-100',
        'model' => 'NCR 6684',
        'location' => 'Lusaka',
        'bank_id' => $bank->id,
        'engineer_id' => $engineer->id,
    ]);
    $openCall = Call::create([
        'atm_id' => $atm->id,
        'assigned_engineer_id' => $engineer->id,
        'status' => 'pending',
        'fault_description' => 'ATM is not responding.',
    ]);
    $resolvedCall = Call::create([
        'atm_id' => $atm->id,
        'assigned_engineer_id' => $engineer->id,
        'status' => 'resolved',
        'fault_description' => 'Card reader issue resolved.',
        'resolved_at' => now(),
    ]);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/engineer/calls?scope=mine&per_page=100')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $openCall->id);

    $this->getJson('/api/v1/engineer/calls?include_resolved=1&per_page=100')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $openCall->id);

    $this->getJson('/api/v1/engineer/calls?scope=mine&include_resolved=1&per_page=100')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonFragment(['id' => $resolvedCall->id]);
});

it('creates job cards only for ATMs assigned to the signed-in engineer', function () {
    $user = User::factory()->create();
    $engineer = Engineer::create([
        'user_id' => $user->id,
        'name' => 'Mobile Engineer',
        'region' => 'Lusaka',
    ]);
    $otherEngineer = Engineer::create(['name' => 'Other Engineer', 'region' => 'Copperbelt']);
    $bank = Bank::create(['name' => 'Example Bank', 'short_code' => 'EX']);
    $atm = Atm::create([
        'terminal_id' => 'ATM-100',
        'model' => 'NCR 6684',
        'location' => 'Lusaka',
        'bank_id' => $bank->id,
        'engineer_id' => $engineer->id,
    ]);
    $otherAtm = Atm::create([
        'terminal_id' => 'ATM-200',
        'model' => 'NCR 6684',
        'location' => 'Copperbelt',
        'bank_id' => $bank->id,
        'engineer_id' => $otherEngineer->id,
    ]);
    Sanctum::actingAs($user);

    $payload = [
        'atm_id' => $atm->id,
        'type' => 'Quarterly PM',
        'job_type' => 'maintenance',
        'work_description' => 'Preventive maintenance checklist completed',
        'checklist' => ['canopyHood' => ['ok']],
        'atm_status' => 'In Service',
        'start_time' => '08:00',
        'end_time' => '09:00',
        'custodian1_name' => 'Custodian',
        'custodian1_signature' => 'signature-data',
        'hours_spent' => 1,
        'scheduled_date' => '2026-10-29',
        'completed_date' => '2026-10-29',
        'quarter' => 4,
        'year' => 2026,
        'phone_support' => false,
        'submit_now' => false,
    ];

    $this->postJson('/api/v1/engineer/job-cards', $payload)
        ->assertCreated()
        ->assertJsonPath('status', 'draft')
        ->assertJsonPath('job_type', 'maintenance');

    $payload['atm_id'] = $otherAtm->id;
    $this->postJson('/api/v1/engineer/job-cards', $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('atm_id');
});

it('serves print-ready job cards only to their assigned engineer', function () {
    $user = User::factory()->create();
    $engineer = Engineer::create([
        'user_id' => $user->id,
        'name' => 'Mobile Engineer',
        'region' => 'Lusaka',
    ]);
    $bank = Bank::create(['name' => 'Example Bank', 'short_code' => 'EX']);
    $atm = Atm::create([
        'terminal_id' => 'ATM-100',
        'model' => 'NCR 6684',
        'location' => 'Lusaka',
        'bank_id' => $bank->id,
        'engineer_id' => $engineer->id,
    ]);
    $card = JobCard::create([
        'atm_id' => $atm->id,
        'engineer_id' => $engineer->id,
        'type' => 'Quarterly PM',
        'job_type' => 'maintenance',
        'work_description' => 'Preventive maintenance completed.',
        'hours_spent' => 1,
        'scheduled_date' => '2026-10-29',
        'quarter' => 4,
        'year' => 2026,
        'status' => 'submitted',
    ]);

    Sanctum::actingAs($user);
    $this->get("/api/v1/engineer/job-cards/{$card->id}/print")
        ->assertOk()
        ->assertSee('ATM Preventive Maintenance Job Card');

    Sanctum::actingAs(User::factory()->create());
    $this->get("/api/v1/engineer/job-cards/{$card->id}/print")->assertForbidden();
});

it('updates an owned draft and appends uploaded attachments', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $engineer = Engineer::create([
        'user_id' => $user->id,
        'name' => 'Mobile Engineer',
        'region' => 'Lusaka',
    ]);
    $bank = Bank::create(['name' => 'Example Bank', 'short_code' => 'EX']);
    $atm = Atm::create([
        'terminal_id' => 'ATM-100',
        'model' => 'NCR 6684',
        'location' => 'Lusaka',
        'bank_id' => $bank->id,
        'engineer_id' => $engineer->id,
    ]);
    $card = JobCard::create([
        'atm_id' => $atm->id,
        'engineer_id' => $engineer->id,
        'type' => 'Quarterly PM',
        'job_type' => 'maintenance',
        'work_description' => 'Preventive maintenance completed.',
        'hours_spent' => 1,
        'scheduled_date' => '2026-10-29',
        'quarter' => 4,
        'year' => 2026,
        'status' => 'draft',
    ]);
    Sanctum::actingAs($user);

    $this->post("/api/v1/engineer/job-cards/{$card->id}", [
        '_method' => 'PUT',
        'work_description' => 'Updated PM checklist completed.',
        'checklist' => ['canopyHood' => ['ok']],
        'files' => [UploadedFile::fake()->image('inspection.jpg')],
    ])->assertOk()
        ->assertJsonPath('work_description', 'Updated PM checklist completed.')
        ->assertJsonPath('attachments.0.name', 'inspection.jpg');

    Storage::disk('public')->assertExists($card->fresh()->attachments[0]['path']);
});
