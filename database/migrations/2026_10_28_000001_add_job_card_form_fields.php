<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_cards', function (Blueprint $table) {
            $table->string('job_type', 30)->nullable()->after('type');
            $table->time('start_time')->nullable()->after('completed_date');
            $table->time('end_time')->nullable()->after('start_time');
            $table->string('fault_category')->nullable()->after('work_description');
            $table->json('checklist')->nullable()->after('fault_category');
            $table->string('atm_status', 40)->nullable()->after('checklist');
            $table->longText('technician_signature')->nullable()->after('atm_status');
            $table->string('custodian1_name')->nullable()->after('technician_signature');
            $table->longText('custodian1_signature')->nullable()->after('custodian1_name');
            $table->string('custodian2_name')->nullable()->after('custodian1_signature');
            $table->longText('custodian2_signature')->nullable()->after('custodian2_name');
        });
    }

    public function down(): void
    {
        Schema::table('job_cards', function (Blueprint $table) {
            $table->dropColumn([
                'job_type',
                'start_time',
                'end_time',
                'fault_category',
                'checklist',
                'atm_status',
                'technician_signature',
                'custodian1_name',
                'custodian1_signature',
                'custodian2_name',
                'custodian2_signature',
            ]);
        });
    }
};
