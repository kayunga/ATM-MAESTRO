FROM php:8.3-cli

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git curl zip unzip libpq-dev libzip-dev libxml2-dev libonig-dev \
    nodejs npm \
    && docker-php-ext-install pdo pdo_pgsql pgsql mbstring xml zip \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Node 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Copy composer files first for layer caching
COPY composer.json composer.lock ./
RUN composer install --optimize-autoloader --no-dev --no-scripts --no-interaction

# Copy package files
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Copy rest of application
COPY . .

# Build frontend assets
RUN npm run build

# Cache Laravel config
RUN php artisan config:cache || true
RUN php artisan route:cache || true
RUN php artisan view:cache || true

EXPOSE $PORT

CMD php artisan migrate --force && php artisan serve --host=0.0.0.0 --port=$PORT
