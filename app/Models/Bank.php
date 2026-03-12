<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Bank extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'short_code',
        'contact_person',
        'contact_phone',
        'contact_email',
        'headquarters',
        'notes',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    // ── Relationships ──────────────────────────────────────────────────────────

    /**
     * ATMs that belong to this bank.
     */
    public function atms(): HasMany
    {
        return $this->hasMany(Atm::class);
    }

    // ── Accessors ─────────────────────────────────────────────────────────────

    /**
     * Count of active ATMs for this bank.
     */
    public function getActiveAtmCountAttribute(): int
    {
        return $this->atms()->where('status', 'Active')->count();
    }
}
