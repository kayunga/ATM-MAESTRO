<?php
// database/migrations/2024_01_01_000002_create_atms_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('atms', function (Blueprint $table) {
            $table->id();
            $table->string('terminal_id', 30)->unique();
            $table->string('serial_number', 60)->nullable()->unique();
            // NCR models only
            $table->string('model', 60); // e.g. NCR 6684, NCR 6627
            $table->string('location');           // Branch / site name
            $table->string('address')->nullable(); // Full address
            $table->foreignId('bank_id')
                  ->nullable()
                  ->constrained('banks')
                  ->nullOnDelete();
            $table->foreignId('engineer_id')
                  ->nullable()
                  ->constrained('engineers')
                  ->nullOnDelete();
            // active | offline | under_maintenance | decommissioned
            $table->string('status', 30)->default('active');
            $table->date('install_date')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('status');
            $table->index('engineer_id');
            $table->index('bank_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('atms');
    }
};
