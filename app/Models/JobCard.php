<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class JobCard extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'atm_id', 'engineer_id', 'reviewed_by',
        'attachments',
        'type', 'work_description', 'parts_used', 'hours_spent',
        'scheduled_date', 'completed_date', 'quarter', 'year',
        'status', 'rejection_reason', 'photos', 'notes',
        'submitted_at', 'reviewed_at',
    ];

    protected $casts = [
        'photos'         => 'array',
        'attachments'    => 'array',
        'scheduled_date' => 'date',
        'completed_date' => 'date',
        'submitted_at'   => 'datetime',
        'reviewed_at'    => 'datetime',
        'hours_spent'    => 'decimal:1',
    ];

    public function atm(): BelongsTo      { return $this->belongsTo(Atm::class); }
    public function engineer(): BelongsTo { return $this->belongsTo(Engineer::class); }
    public function reviewer(): BelongsTo { return $this->belongsTo(User::class, 'reviewed_by'); }

    public function scopePending($query)       { return $query->where('status', 'submitted'); }
    public function scopeForEngineer($query, int $id) { return $query->where('engineer_id', $id); }
}
