<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('job_cards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('atm_id')->constrained('atms')->cascadeOnDelete();
            $table->foreignId('engineer_id')->constrained('engineers')->cascadeOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('type')->default('Quarterly PM');
            $table->text('work_description');
            $table->text('parts_used')->nullable();
            $table->decimal('hours_spent', 4, 1)->default(0);
            $table->date('scheduled_date');
            $table->date('completed_date')->nullable();
            $table->tinyInteger('quarter')->default(1);
            $table->year('year');
            $table->enum('status', ['draft', 'submitted', 'approved', 'rejected'])->default('draft');
            $table->text('rejection_reason')->nullable();
            $table->json('photos')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('job_cards');
    }
};
