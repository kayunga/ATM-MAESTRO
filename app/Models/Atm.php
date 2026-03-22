<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Atm extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'atms';

    protected $fillable = [
        'terminal_id',
        'serial_number',
        'model',
        'location',
        'address',
        'bank_id',
        'engineer_id',
        'status',
        'install_date',
        'notes',
    ];

    protected $casts = [
        'install_date' => 'date',
    ];

    // ── Relationships ─────────────────────────────────────────────────────────

    public function bank(): BelongsTo
    {
        return $this->belongsTo(Bank::class);
    }

    public function engineer(): BelongsTo
    {
        return $this->belongsTo(Engineer::class);
    }

    public function maintenanceRecords(): HasMany
    {
        return $this->hasMany(MaintenanceRecord::class);
    }

    public function jobCards(): HasMany
    {
        return $this->hasMany(JobCard::class);
    }

    public function calls(): HasMany
    {
        return $this->hasMany(Call::class);
    }

    // ── Scopes ────────────────────────────────────────────────────────────────

    public function scopeActive($query)
    {
        return $query->where('status', 'Active');
    }

    public function scopeOffline($query)
    {
        return $query->where('status', 'Offline');
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public function hasQuarterlyPm(int $quarter, int $year): bool
    {
        return $this->maintenanceRecords()
            ->where('type', 'Quarterly PM')
            ->where('quarter', $quarter)
            ->where('year', $year)
            ->where('status', 'Completed')
            ->exists();
    }

    public static function missingQuarterlyPm(int $quarter, int $year)
    {
        return static::whereDoesntHave('maintenanceRecords', function ($q) use ($quarter, $year) {
            $q->where('type', 'Quarterly PM')
              ->where('quarter', $quarter)
              ->where('year', $year)
              ->where('status', 'Completed');
        })->get();
    }
}
