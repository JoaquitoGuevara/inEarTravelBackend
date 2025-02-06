let mix = require('laravel-mix');

mix.sass('resources/sass/app.scss', 'dist/css');
mix.copyDirectory('resources/images', 'public/dist/images');
mix.js('resources/js/main.js', 'public/dist/js/main.min.js');
