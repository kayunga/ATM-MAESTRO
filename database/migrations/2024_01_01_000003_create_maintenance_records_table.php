<?php
// database/migrations/2024_01_01_000003_create_maintenance_records_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('maintenance_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('atm_id')->constrained('atms')->cascadeOnDelete();
            $table->foreignId('engineer_id')->nullable()->constrained('engineers')->nullOnDelete();

            // Quarterly PM | Emergency | Part Replacement | Software Update | Cash Jam | Card Reader Service
            $table->string('type', 60)->default('Quarterly PM');
            // scheduled | in_progress | completed | cancelled
            $table->string('status', 30)->default('scheduled');

            $table->date('scheduled_date');
            $table->date('completed_date')->nullable();

            // Which quarter this PM belongs to (1-4)
            $table->unsignedTinyInteger('quarter');
            $table->unsignedSmallInteger('year');

            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['atm_id', 'quarter', 'year']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('maintenance_records');
    }
};
