<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Call extends Model
{
    use SoftDeletes;

    const SLA_HOURS = ['high' => 2, 'medium' => 3, 'low' => 5];

    protected $fillable = [
        'atm_id', 'assigned_engineer_id', 'assigned_by',
        'call_type', 'status', 'priority',
        'fault_description', 'notes', 'resolution_notes',
        'assigned_at', 'resolved_at', 'escalated_at',
        'sla_breach_at', 'sla_breached', 'closed_at',
    ];

    protected $casts = [
        'assigned_at'   => 'datetime',
        'resolved_at'   => 'datetime',
        'escalated_at'  => 'datetime',
        'sla_breach_at' => 'datetime',
        'closed_at'     => 'datetime',
        'sla_breached'  => 'boolean',
    ];

    public function atm(): BelongsTo      { return $this->belongsTo(Atm::class); }
    public function engineer(): BelongsTo { return $this->belongsTo(Engineer::class, 'assigned_engineer_id'); }
    public function assignedBy(): BelongsTo { return $this->belongsTo(User::class, 'assigned_by'); }
    public function jobCards(): HasMany    { return $this->hasMany(JobCard::class); }

    public function calculateSlaBreach(): \Carbon\Carbon
    {
        $hours = self::SLA_HOURS[$this->priority] ?? 3;
        return $this->created_at->copy()->addHours($hours);
    }

    public function isSlaBreached(): bool
    {
        if (!$this->sla_breach_at) return false;
        if ($this->status === 'resolved' && $this->closed_at) {
            return $this->closed_at->gt($this->sla_breach_at);
        }
        return now()->gt($this->sla_breach_at);
    }

    public function slaMinutesRemaining(): int
    {
        if (!$this->sla_breach_at) return 999;
        return (int) now()->diffInMinutes($this->sla_breach_at, false);
    }
}
