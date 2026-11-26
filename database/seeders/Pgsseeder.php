<?php

namespace Database\Seeders;

use App\Models\Atm;
use App\Models\Bank;
use App\Models\Call;
use App\Models\Engineer;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class Pgsseeder extends Seeder
{
    public function run(): void
    {
        $adminPassword = config('pgsseeder.admin_password');
        $engineerPassword = config('pgsseeder.engineer_password');

        foreach ([
            'PGSSEED_ADMIN_PASSWORD' => $adminPassword,
            'PGSSEED_ENGINEER_PASSWORD' => $engineerPassword,
        ] as $key => $password) {
            if (! is_string($password) || strlen($password) < 12) {
                throw new RuntimeException("Set {$key} to a password of at least 12 characters before running this seeder.");
            }
        }

        DB::transaction(function () use ($adminPassword, $engineerPassword): void {
            $admin = User::updateOrCreate(
                ['email' => 'early-access-admin@example.com'],
                [
                    'name' => 'Early Access Admin',
                    'password' => Hash::make($adminPassword),
                    'is_admin' => true,
                ],
            );

            $engineerData = [
                [
                    'name' => 'Lusaka Engineer',
                    'phone' => '+260 97 111 2233',
                    'email' => 'lusaka.engineer@example.com',
                    'region' => 'Lusaka',
                ],
                [
                    'name' => 'Copperbelt Engineer',
                    'phone' => '+260 96 234 5678',
                    'email' => 'copperbelt.engineer@example.com',
                    'region' => 'Copperbelt',
                ],
                [
                    'name' => 'Southern Engineer',
                    'phone' => '+260 95 345 6789',
                    'email' => 'southern.engineer@example.com',
                    'region' => 'Southern',
                ],
            ];

            $engineers = [];

            foreach ($engineerData as $data) {
                $user = User::updateOrCreate(
                    ['email' => $data['email']],
                    [
                        'name' => $data['name'],
                        'password' => Hash::make($engineerPassword),
                        'is_admin' => false,
                    ],
                );

                $engineers[$data['region']] = Engineer::updateOrCreate(
                    ['email' => $data['email']],
                    [
                        'name' => $data['name'],
                        'phone' => $data['phone'],
                        'region' => $data['region'],
                        'user_id' => $user->id,
                    ],
                );
            }

            $bank = Bank::updateOrCreate(
                ['short_code' => 'EA'],
                [
                    'name' => 'Early Access Bank',
                    'headquarters' => 'Lusaka',
                ],
            );

            $atmData = [
                [
                    'terminal_id' => 'ATM-EA-LUS-001',
                    'serial_number' => 'EA-NCR-0001',
                    'model' => 'NCR 6684',
                    'location' => 'Lusaka Main Branch',
                    'address' => 'Cairo Road, Lusaka',
                    'engineer' => 'Lusaka',
                    'status' => 'Active',
                    'install_date' => '2024-01-15',
                    'notes' => 'Early-access sample ATM',
                ],
                [
                    'terminal_id' => 'ATM-EA-CBE-001',
                    'serial_number' => 'EA-NCR-0002',
                    'model' => 'NCR 6627',
                    'location' => 'Kitwe Main Branch',
                    'address' => 'Independence Avenue, Kitwe',
                    'engineer' => 'Copperbelt',
                    'status' => 'Active',
                    'install_date' => '2024-02-01',
                    'notes' => 'Early-access sample ATM',
                ],
                [
                    'terminal_id' => 'ATM-EA-SOU-001',
                    'serial_number' => 'EA-NCR-0003',
                    'model' => 'NCR SelfServ 84',
                    'location' => 'Livingstone Branch',
                    'address' => 'Mosi-oa-Tunya Road, Livingstone',
                    'engineer' => 'Southern',
                    'status' => 'Under Maintenance',
                    'install_date' => '2024-03-10',
                    'notes' => 'Early-access sample ATM',
                ],
            ];

            $atms = [];

            foreach ($atmData as $data) {
                $atms[$data['engineer']] = Atm::updateOrCreate(
                    ['terminal_id' => $data['terminal_id']],
                    [
                        'serial_number' => $data['serial_number'],
                        'model' => $data['model'],
                        'location' => $data['location'],
                        'address' => $data['address'],
                        'bank_id' => $bank->id,
                        'engineer_id' => $engineers[$data['engineer']]->id,
                        'status' => $data['status'],
                        'has_gbna' => $data['model'] === 'NCR 6684',
                        'install_date' => $data['install_date'],
                        'notes' => $data['notes'],
                    ],
                );
            }

            $calls = [
                [
                    'atm' => 'Lusaka',
                    'engineer' => null,
                    'call_type' => 'new',
                    'status' => 'pending',
                    'priority' => 'high',
                    'fault_description' => 'Cash dispenser is not presenting notes.',
                    'notes' => 'Early-access sample call awaiting assignment.',
                    'assigned_at' => null,
                    'sla_breach_at' => now()->addHours(2),
                ],
                [
                    'atm' => 'Copperbelt',
                    'engineer' => 'Copperbelt',
                    'call_type' => 'repeat',
                    'status' => 'assigned',
                    'priority' => 'medium',
                    'fault_description' => 'Card reader intermittently fails to read cards.',
                    'notes' => 'Early-access sample call assigned to an engineer.',
                    'assigned_at' => now(),
                    'sla_breach_at' => now()->addHours(3),
                ],
                [
                    'atm' => 'Southern',
                    'engineer' => null,
                    'call_type' => 'new',
                    'status' => 'pending',
                    'priority' => 'low',
                    'fault_description' => 'Receipt printer needs inspection.',
                    'notes' => 'Early-access sample call awaiting assignment.',
                    'assigned_at' => null,
                    'sla_breach_at' => now()->addHours(5),
                ],
            ];

            foreach ($calls as $data) {
                Call::updateOrCreate(
                    [
                        'atm_id' => $atms[$data['atm']]->id,
                        'fault_description' => $data['fault_description'],
                    ],
                    [
                        'assigned_engineer_id' => $data['engineer']
                            ? $engineers[$data['engineer']]->id
                            : null,
                        'assigned_by' => $data['engineer'] ? $admin->id : null,
                        'call_type' => $data['call_type'],
                        'status' => $data['status'],
                        'priority' => $data['priority'],
                        'notes' => $data['notes'],
                        'assigned_at' => $data['assigned_at'],
                        'sla_breach_at' => $data['sla_breach_at'],
                    ],
                );
            }
        });

        $this->command?->info('Early-access Postgres seed data created or updated.');
    }
}
