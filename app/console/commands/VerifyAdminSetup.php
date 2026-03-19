<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;

class VerifyAdminSetup extends Command
{
    protected $signature   = 'admin:verify';
    protected $description = 'Verify admin user exists and has is_admin = true';

    public function handle()
    {
        // Check is_admin column exists
        if (!Schema::hasColumn('users', 'is_admin')) {
            $this->error('❌ is_admin column missing from users table.');
            $this->info('   Run: php artisan migrate');
            return 1;
        }
        $this->info('✓ is_admin column exists');

        // Check admin user
        $admin = User::where('email', 'admin@techmasters.zm')->first();
        if (!$admin) {
            $this->error('❌ Admin user not found.');
            $this->info('   Run: php artisan db:seed --class=AdminUserSeeder');
            return 1;
        }

        if (!$admin->is_admin) {
            $admin->update(['is_admin' => true]);
            $this->warn('⚠  Admin user found but is_admin was false — fixed.');
        } else {
            $this->info('✓ Admin user exists and is_admin = true');
        }

        // List all admin users
        $admins = User::where('is_admin', true)->get(['id','name','email']);
        $this->info("\nAdmin users ({$admins->count()}):");
        foreach ($admins as $u) {
            $this->line("  #{$u->id} {$u->name} <{$u->email}>");
        }

        return 0;
    }
}
