<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class JobCard extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'atm_id', 'engineer_id', 'reviewed_by', 'call_id',
        'attachments', 'type', 'work_description', 'parts_used',
        'hours_spent', 'scheduled_date', 'completed_date',
        'quarter', 'year', 'status', 'rejection_reason',
        'photos', 'notes', 'submitted_at', 'reviewed_at',
        'job_type', 'start_time', 'end_time', 'fault_category',
        'checklist', 'atm_status', 'technician_signature', 'phone_support',
        'custodian1_name', 'custodian1_signature',
        'custodian2_name', 'custodian2_signature',
    ];

    protected $casts = [
        'photos' => 'array',
        'attachments' => 'array',
        'checklist' => 'array',
        'phone_support' => 'boolean',
        'scheduled_date' => 'date',
        'completed_date' => 'date',
        'submitted_at' => 'datetime',
        'reviewed_at' => 'datetime',
        'hours_spent' => 'decimal:1',
    ];

    public function atm(): BelongsTo
    {
        return $this->belongsTo(Atm::class);
    }

    public function engineer(): BelongsTo
    {
        return $this->belongsTo(Engineer::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function call(): BelongsTo
    {
        return $this->belongsTo(Call::class);
    }

    public function scopePending($query)
    {
        return $query->where('status', 'submitted');
    }

    public function scopeForEngineer($query, int $id)
    {
        return $query->where('engineer_id', $id);
    }

    public function scopeForAdminFilters(Builder $query, array $filters): Builder
    {
        $status = $filters['status'] ?? 'all';
        $search = trim($filters['search'] ?? '');
        $jobType = $filters['job_type'] ?? 'all';

        return $query
            ->when($status !== 'all', fn (Builder $query) => $query->where('status', $status))
            ->when(isset($filters['quarter']), fn (Builder $query) => $query->where('quarter', $filters['quarter']))
            ->when(isset($filters['year']), fn (Builder $query) => $query->where('year', $filters['year']))
            ->when(isset($filters['bank_id']), fn (Builder $query) => $query->whereHas('atm', fn (Builder $atm) => $atm->where('bank_id', $filters['bank_id'])))
            ->when($search !== '', function (Builder $query) use ($search): void {
                $query->where(function (Builder $matches) use ($search): void {
                    if (ctype_digit($search)) {
                        $matches->where('id', (int) $search);
                    }

                    $matches->orWhere('type', 'like', "%{$search}%")
                        ->orWhereHas('atm', function (Builder $atm) use ($search): void {
                            $atm->where('terminal_id', 'like', "%{$search}%")
                                ->orWhere('location', 'like', "%{$search}%")
                                ->orWhereHas('bank', function (Builder $bank) use ($search): void {
                                    $bank->where('name', 'like', "%{$search}%")
                                        ->orWhere('short_code', 'like', "%{$search}%");
                                });
                        })
                        ->orWhereHas('engineer', fn (Builder $engineer) => $engineer->where('name', 'like', "%{$search}%"));
                });
            })
            ->when($jobType === 'repair', fn (Builder $query) => $query->where('job_type', 'repair'))
            ->when($jobType === 'maintenance', fn (Builder $query) => $query->where(function (Builder $query): void {
                $query->where('job_type', 'maintenance')
                    ->orWhere(fn (Builder $legacy) => $legacy->whereNull('job_type')->where('type', 'Quarterly PM'));
            }));
    }
}
