<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('atms')
            ->where(function ($query) {
                $query->whereRaw('LOWER(location) LIKE ?', ['%adt%'])
                    ->orWhereRaw('LOWER(model) LIKE ?', ['%6684%'])
                    ->orWhereRaw('LOWER(model) LIKE ?', ['%selfserv 84%']);
            })
            ->update(['has_gbna' => true]);
    }

    public function down(): void
    {
        DB::table('atms')
            ->where(function ($query) {
                $query->whereRaw('LOWER(location) LIKE ?', ['%adt%'])
                    ->orWhereRaw('LOWER(model) LIKE ?', ['%6684%'])
                    ->orWhereRaw('LOWER(model) LIKE ?', ['%selfserv 84%']);
            })
            ->update(['has_gbna' => false]);
    }
};
