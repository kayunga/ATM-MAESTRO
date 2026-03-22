<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('calls', function (Blueprint $table) {
            // SLA deadline — calculated when call is logged based on priority
            $table->timestamp('sla_breach_at')->nullable()->after('escalated_at');
            // Set true if resolved_at > sla_breach_at, or still open past breach time
            $table->boolean('sla_breached')->default(false)->after('sla_breach_at');
            // Custom close time chosen by engineer (replaces auto now())
            $table->timestamp('closed_at')->nullable()->after('sla_breached');
        });
    }

    public function down(): void
    {
        Schema::table('calls', function (Blueprint $table) {
            $table->dropColumn(['sla_breach_at', 'sla_breached', 'closed_at']);
        });
    }
};
