<?php

namespace Database\Seeders;

use App\Models\Engineer;
use App\Models\MaintenanceRecord;
use Illuminate\Database\Seeder;

class MaintenanceSeeder extends Seeder
{
    public function run(): void
    {
        $engineers = Engineer::query()
            ->whereNotIn('name', ['Lazarus', 'Kasampi'])
            ->with('atms')
            ->get();

        foreach ($engineers as $engineer) {
            foreach ($engineer->atms as $atm) {
                MaintenanceRecord::updateOrCreate(
                    [
                        'atm_id' => $atm->id,
                        'type' => 'Quarterly PM',
                        'quarter' => 4,
                        'year' => 2026,
                    ],
                    [
                        'engineer_id' => $engineer->id,
                        'status' => 'Scheduled',
                        'scheduled_date' => '2026-12-31',
                        'completed_date' => null,
                        'notes' => 'Q4 2026 Preventive Maintenance',
                    ],
                );
            }
        }

        $this->command?->info('Q4 2026 maintenance records seeded.');
    }
}
