<?php

namespace Database\Seeders\Concerns;

use RuntimeException;

trait ReadsSeedPasswords
{
    /**
     * Read an initial password from config/seeding.php.
     */
    protected function seedPassword(string $key, string $envName): string
    {
        $password = (string) config("seeding.{$key}");

        if ($password === '') {
            throw new RuntimeException(
                "No seed password configured; set {$envName}."
            );
        }

        return $password;
    }
}
