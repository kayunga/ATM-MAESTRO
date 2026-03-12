<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // ── Banks ─────────────────────────────────────────────────────────────
        $banks = [
            ['name' => 'Zanaco',               'short_code' => 'ZNC', 'contact_person' => 'Mutale Nkonde',  'contact_phone' => '+260 211 228 888', 'contact_email' => 'operations@zanaco.zm',   'headquarters' => 'Cairo Road, Lusaka',              'notes' => 'Largest bank fleet'],
            ['name' => 'Stanbic Bank Zambia',  'short_code' => 'SBZ', 'contact_person' => 'Chanda Mwewa',   'contact_phone' => '+260 211 370 600', 'contact_email' => 'support@stanbic.zm',     'headquarters' => 'Addis Ababa Roundabout, Lusaka',  'notes' => null],
            ['name' => 'FNB Zambia',           'short_code' => 'FNB', 'contact_person' => 'Bwalya Tembo',   'contact_phone' => '+260 211 369 000', 'contact_email' => 'fnbzambia@fnb.zm',        'headquarters' => 'Farmers House, Lusaka',           'notes' => null],
            ['name' => 'Absa Bank Zambia',     'short_code' => 'ABS', 'contact_person' => 'Tendai Phiri',   'contact_phone' => '+260 211 370 700', 'contact_email' => 'absazambia@absa.africa',  'headquarters' => 'Kafue Road, Lusaka',              'notes' => null],
        ];

        DB::table('banks')->insert(array_map(fn ($b) => array_merge($b, [
            'created_at' => now(), 'updated_at' => now(),
        ]), $banks));

        $bankIds = DB::table('banks')->orderBy('id')->pluck('id', 'short_code');

        // ── Engineers ─────────────────────────────────────────────────────────
        $engineers = [
            ['name' => 'Tendai Mwale',   'phone' => '+260 97 111 2233', 'email' => 't.mwale@ncrservice.zm',  'region' => 'Lusaka'],
            ['name' => 'Bwalya Mutale',  'phone' => '+260 96 234 5678', 'email' => 'b.mutale@ncrservice.zm', 'region' => 'Copperbelt'],
            ['name' => 'Chanda Phiri',   'phone' => '+260 95 345 6789', 'email' => 'c.phiri@ncrservice.zm',  'region' => 'Southern'],
            ['name' => 'Mulenga Banda',  'phone' => '+260 97 456 7890', 'email' => 'm.banda@ncrservice.zm',  'region' => 'Lusaka'],
        ];

        DB::table('engineers')->insert(array_map(fn ($e) => array_merge($e, [
            'created_at' => now(), 'updated_at' => now(),
        ]), $engineers));

        $engIds = DB::table('engineers')->orderBy('id')->pluck('id')->toArray();
        [$e1, $e2, $e3, $e4] = $engIds;

        // ── ATMs ──────────────────────────────────────────────────────────────
        $atms = [
            ['terminal_id' => 'ATM-ZNC-001', 'serial_number' => 'NCR684001ZM',  'model' => 'NCR 6684',        'location' => 'Cairo Road Branch',      'address' => 'Cairo Road, Lusaka CBD',                     'bank_id' => $bankIds['ZNC'], 'engineer_id' => $e1, 'status' => 'Active',           'install_date' => '2021-03-15', 'notes' => 'High traffic site'],
            ['terminal_id' => 'ATM-ZNC-002', 'serial_number' => 'NCR627002ZM',  'model' => 'NCR 6627',        'location' => 'Manda Hill Mall',         'address' => 'Manda Hill Shopping Centre, Lusaka',          'bank_id' => $bankIds['ZNC'], 'engineer_id' => $e1, 'status' => 'Active',           'install_date' => '2020-08-10', 'notes' => null],
            ['terminal_id' => 'ATM-SBZ-001', 'serial_number' => 'NCR634003ZM',  'model' => 'NCR 6634',        'location' => 'Kitwe Main Branch',       'address' => 'Independence Ave, Kitwe',                     'bank_id' => $bankIds['SBZ'], 'engineer_id' => $e2, 'status' => 'Under Maintenance', 'install_date' => '2019-11-20', 'notes' => 'Card reader issue'],
            ['terminal_id' => 'ATM-FNB-001', 'serial_number' => 'NCRSS84004ZM', 'model' => 'NCR SelfServ 84', 'location' => 'Livingstone Airport',     'address' => 'Harry Mwanga Nkumbula Airport, Livingstone',   'bank_id' => $bankIds['FNB'], 'engineer_id' => $e3, 'status' => 'Active',           'install_date' => '2022-01-05', 'notes' => 'Tourist area'],
            ['terminal_id' => 'ATM-ABS-001', 'serial_number' => 'NCR622005ZM',  'model' => 'NCR 6622',        'location' => 'Arcades Shopping Centre', 'address' => 'Great East Road, Lusaka',                     'bank_id' => $bankIds['ABS'], 'engineer_id' => $e4, 'status' => 'Offline',          'install_date' => '2018-06-12', 'notes' => 'Power issue'],
        ];

        DB::table('atms')->insert(array_map(fn ($a) => array_merge($a, [
            'created_at' => now(), 'updated_at' => now(),
        ]), $atms));

        $atmIds = DB::table('atms')->orderBy('id')->pluck('id', 'terminal_id');

        // ── Maintenance records ────────────────────────────────────────────────
        $records = [
            ['atm_id' => $atmIds['ATM-ZNC-001'], 'engineer_id' => $e1, 'type' => 'Quarterly PM',        'status' => 'Completed',   'scheduled_date' => '2024-01-15', 'completed_date' => '2024-01-15', 'quarter' => 1, 'year' => 2024, 'notes' => 'All checks passed.'],
            ['atm_id' => $atmIds['ATM-ZNC-001'], 'engineer_id' => $e1, 'type' => 'Quarterly PM',        'status' => 'Completed',   'scheduled_date' => '2024-04-10', 'completed_date' => '2024-04-12', 'quarter' => 2, 'year' => 2024, 'notes' => 'Card reader cleaned.'],
            ['atm_id' => $atmIds['ATM-ZNC-002'], 'engineer_id' => $e1, 'type' => 'Quarterly PM',        'status' => 'Completed',   'scheduled_date' => '2024-03-20', 'completed_date' => '2024-03-20', 'quarter' => 1, 'year' => 2024, 'notes' => 'Routine PM.'],
            ['atm_id' => $atmIds['ATM-SBZ-001'], 'engineer_id' => $e2, 'type' => 'Card Reader Service', 'status' => 'In Progress', 'scheduled_date' => '2024-07-01', 'completed_date' => null,          'quarter' => 3, 'year' => 2024, 'notes' => 'Awaiting spare part.'],
            ['atm_id' => $atmIds['ATM-FNB-001'], 'engineer_id' => $e3, 'type' => 'Quarterly PM',        'status' => 'Scheduled',   'scheduled_date' => '2024-07-15', 'completed_date' => null,          'quarter' => 3, 'year' => 2024, 'notes' => null],
            ['atm_id' => $atmIds['ATM-ABS-001'], 'engineer_id' => $e4, 'type' => 'Emergency',           'status' => 'Completed',   'scheduled_date' => '2024-06-28', 'completed_date' => '2024-06-29', 'quarter' => 2, 'year' => 2024, 'notes' => 'Replaced PSU.'],
        ];

        DB::table('maintenance_records')->insert(array_map(fn ($r) => array_merge($r, [
            'created_at' => now(), 'updated_at' => now(),
        ]), $records));

        $this->command->info('✅ ATM Fleet seeded: 4 banks, 4 engineers, 5 ATMs, 6 maintenance records.');
    }
}
