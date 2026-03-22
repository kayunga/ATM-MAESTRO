<?php
// database/seeders/DatabaseSeeder.php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Engineer;
use App\Models\Atm;
use App\Models\MaintenanceRecord;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // ── Engineers ──────────────────────────────────────────────────────
        $engineers = collect([
            ['name' => 'Tendai Mwale',  'phone' => '+260 97 111 2233', 'email' => 't.mwale@ncrservice.zm',  'region' => 'Lusaka'],
            ['name' => 'Bwalya Mutale', 'phone' => '+260 96 234 5678', 'email' => 'b.mutale@ncrservice.zm', 'region' => 'Copperbelt'],
            ['name' => 'Chanda Phiri',  'phone' => '+260 95 345 6789', 'email' => 'c.phiri@ncrservice.zm',  'region' => 'Southern'],
            ['name' => 'Mulenga Banda', 'phone' => '+260 97 456 7890', 'email' => 'm.banda@ncrservice.zm',  'region' => 'Lusaka'],
        ])->map(fn($e) => Engineer::create($e));

        [$tendai, $bwalya, $chanda, $mulenga] = $engineers;

        // ── ATMs ───────────────────────────────────────────────────────────
        $atms = [
            Atm::create(['terminal_id' => 'ATM-LUS-001', 'serial_number' => 'NCR684001ZM', 'model' => 'NCR 6684', 'location' => 'Cairo Road Branch',     'address' => 'Cairo Road, Lusaka CBD',              'engineer_id' => $tendai->id,  'status' => 'Active',            'install_date' => '2021-03-15', 'notes' => 'High traffic site']),
            Atm::create(['terminal_id' => 'ATM-LUS-002', 'serial_number' => 'NCR627002ZM', 'model' => 'NCR 6627', 'location' => 'Manda Hill Mall',        'address' => 'Manda Hill Shopping Centre, Lusaka',  'engineer_id' => $tendai->id,  'status' => 'Active',            'install_date' => '2020-08-10', 'notes' => null]),
            Atm::create(['terminal_id' => 'ATM-CBE-001', 'serial_number' => 'NCR634003ZM', 'model' => 'NCR 6634', 'location' => 'Kitwe Main Branch',      'address' => 'Independence Ave, Kitwe',             'engineer_id' => $bwalya->id,  'status' => 'Under Maintenance', 'install_date' => '2019-11-20', 'notes' => 'Card reader issue reported']),
            Atm::create(['terminal_id' => 'ATM-LIV-001', 'serial_number' => 'NCRSS84004ZM','model' => 'NCR SelfServ 84','location'=>'Livingstone Airport','address' => 'Harry Mwanga Nkumbula Airport, Livingstone','engineer_id' => $chanda->id,'status' => 'Active',           'install_date' => '2022-01-05', 'notes' => 'Tourist area']),
            Atm::create(['terminal_id' => 'ATM-LUS-003', 'serial_number' => 'NCR622005ZM', 'model' => 'NCR 6622', 'location' => 'Arcades Shopping Centre','address' => 'Great East Road, Lusaka',             'engineer_id' => $mulenga->id, 'status' => 'Offline',           'install_date' => '2018-06-12', 'notes' => 'Power issue – under investigation']),
        ];

        // ── Maintenance Records ────────────────────────────────────────────
        MaintenanceRecord::create(['atm_id' => $atms[0]->id, 'engineer_id' => $tendai->id,  'type' => 'Quarterly PM',       'status' => 'Completed',   'scheduled_date' => '2024-01-15', 'completed_date' => '2024-01-15', 'quarter' => 1, 'year' => 2024, 'notes' => 'All checks passed. Thermal printer head cleaned.']);
        MaintenanceRecord::create(['atm_id' => $atms[0]->id, 'engineer_id' => $tendai->id,  'type' => 'Quarterly PM',       'status' => 'Completed',   'scheduled_date' => '2024-04-10', 'completed_date' => '2024-04-12', 'quarter' => 2, 'year' => 2024, 'notes' => 'Replaced receipt paper. Card reader cleaned.']);
        MaintenanceRecord::create(['atm_id' => $atms[1]->id, 'engineer_id' => $tendai->id,  'type' => 'Quarterly PM',       'status' => 'Completed',   'scheduled_date' => '2024-03-20', 'completed_date' => '2024-03-20', 'quarter' => 1, 'year' => 2024, 'notes' => 'Routine PM completed.']);
        MaintenanceRecord::create(['atm_id' => $atms[2]->id, 'engineer_id' => $bwalya->id,  'type' => 'Card Reader Service','status' => 'In Progress', 'scheduled_date' => '2024-07-01', 'completed_date' => null,         'quarter' => 3, 'year' => 2024, 'notes' => 'Awaiting spare part delivery.']);
        MaintenanceRecord::create(['atm_id' => $atms[3]->id, 'engineer_id' => $chanda->id,  'type' => 'Quarterly PM',       'status' => 'Scheduled',   'scheduled_date' => '2024-07-15', 'completed_date' => null,         'quarter' => 3, 'year' => 2024, 'notes' => null]);
        MaintenanceRecord::create(['atm_id' => $atms[4]->id, 'engineer_id' => $mulenga->id, 'type' => 'Emergency',          'status' => 'Completed',   'scheduled_date' => '2024-06-28', 'completed_date' => '2024-06-29', 'quarter' => 2, 'year' => 2024, 'notes' => 'Power surge damage. Replaced PSU.']);

        $this->command->info('✓ ATM Fleet Manager seeded successfully.');
    }
}
