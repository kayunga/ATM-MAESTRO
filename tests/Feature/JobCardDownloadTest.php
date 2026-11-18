<?php

use App\Models\Atm;
use App\Models\Bank;
use App\Models\Engineer;
use App\Models\JobCard;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('filters job cards by quarter, year, bank, and maintenance or repair type', function () {
    $admin = User::factory()->create(['is_admin' => true]);
    $bank = Bank::create(['name' => 'Example Bank', 'short_code' => 'EX']);
    $otherBank = Bank::create(['name' => 'Other Bank', 'short_code' => 'OT']);
    $engineer = Engineer::create(['name' => 'Test Engineer', 'region' => 'Central']);

    $createAtm = fn (Bank $bank, string $terminalId) => Atm::create([
        'terminal_id' => $terminalId,
        'model' => 'NCR 6684',
        'location' => 'Lusaka',
        'bank_id' => $bank->id,
    ]);
    $atm = $createAtm($bank, 'ATM-100');
    $otherAtm = $createAtm($otherBank, 'ATM-200');

    $createCard = function (Atm $atm, string $jobType, int $quarter, int $year, ?string $type = null) use ($engineer): JobCard {
        return JobCard::create([
            'atm_id' => $atm->id,
            'engineer_id' => $engineer->id,
            'type' => $type ?? ($jobType === 'repair' ? 'Repair' : 'Quarterly PM'),
            'job_type' => $jobType,
            'work_description' => 'Routine service',
            'scheduled_date' => "{$year}-".str_pad((string) ($quarter * 3), 2, '0', STR_PAD_LEFT).'-15',
            'quarter' => $quarter,
            'year' => $year,
            'status' => 'approved',
        ]);
    };

    $maintenanceCard = $createCard($atm, 'maintenance', 4, 2025);
    $repairCard = $createCard($atm, 'repair', 4, 2025);
    $createCard($atm, 'maintenance', 3, 2025);
    $createCard($otherAtm, 'maintenance', 4, 2025);

    $this->actingAs($admin)
        ->getJson("/job-cards/data?status=all&quarter=4&year=2025&bank_id={$bank->id}&job_type=maintenance")
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.id', $maintenanceCard->id);

    $this->actingAs($admin)
        ->getJson("/job-cards/data?status=all&quarter=4&year=2025&bank_id={$bank->id}&job_type=repair")
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.id', $repairCard->id);

    $this->actingAs($admin)
        ->getJson("/job-cards/data?status=all&quarter=4&year=2025&bank_id={$bank->id}&job_type=repair&ids_only=1")
        ->assertOk()
        ->assertJsonPath('ids.0', $repairCard->id);
});
