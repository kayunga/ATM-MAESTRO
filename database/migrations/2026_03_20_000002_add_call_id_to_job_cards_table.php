<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_cards', function (Blueprint $table) {
            $table->foreignId('call_id')
                ->nullable()
                ->after('engineer_id')
                ->constrained('calls')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('job_cards', function (Blueprint $table) {
            $table->dropForeignIdFor(\App\Models\Call::class);
            $table->dropColumn('call_id');
        });
    }
};
