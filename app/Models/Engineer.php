<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Engineer extends Model
{
    use SoftDeletes;

    protected $fillable = ['user_id', 'name', 'phone', 'email', 'region'];

    public function user(): BelongsTo               { return $this->belongsTo(User::class); }
    public function atms(): HasMany                  { return $this->hasMany(Atm::class); }
    public function jobCards(): HasMany              { return $this->hasMany(JobCard::class); }
    public function maintenanceRecords(): HasMany    { return $this->hasMany(MaintenanceRecord::class); }
}
