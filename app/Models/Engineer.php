<?php
// app/Models/Engineer.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Engineer extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'phone',
        'email',
        'region',
    ];

    // ── Relationships ──────────────────────────────────────────────────────
    public function atms()
    {
        return $this->hasMany(Atm::class);
    }

    public function maintenanceRecords()
    {
        return $this->hasMany(MaintenanceRecord::class);
    }

    // ── Accessors ──────────────────────────────────────────────────────────
    public function getAtmCountAttribute(): int
    {
        return $this->atms()->count();
    }
}
