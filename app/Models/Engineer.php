<?php
// app/Models/Engineer.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\User;

class Engineer extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'phone',
        'email',
        'region',
        'user_id',
    ];

    // ── Relationships ──────────────────────────────────────────────────────
    public function user()
    {
        return $this->belongsTo(User::class);
    }

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
