<?php
// app/Models/MaintenanceRecord.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class MaintenanceRecord extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'atm_id',
        'engineer_id',
        'type',
        'status',
        'scheduled_date',
        'completed_date',
        'quarter',
        'year',
        'notes',
    ];

    protected $casts = [
        'scheduled_date'  => 'date',
        'completed_date'  => 'date',
        'quarter'         => 'integer',
        'year'            => 'integer',
    ];

    // ── Relationships ──────────────────────────────────────────────────────
    public function atm()
    {
        return $this->belongsTo(Atm::class);
    }

    public function engineer()
    {
        return $this->belongsTo(Engineer::class);
    }

    // ── Scopes ─────────────────────────────────────────────────────────────
    public function scopeCompleted($query)
    {
        return $query->where('status', 'Completed');
    }

    public function scopeForQuarter($query, int $quarter, int $year)
    {
        return $query->where('quarter', $quarter)->where('year', $year);
    }

    public function scopeQuarterlyPm($query)
    {
        return $query->where('type', 'Quarterly PM');
    }
}
