let mix = require('laravel-mix');

mix.sass('resources/sass/app.scss', 'dist/css');
mix.sass('resources/sass/poicustomization.scss', 'public/dist/css/poicustomization.css');
mix.copyDirectory('resources/images', 'public/dist/images');
mix.js('resources/js/main.js', 'public/dist/js/main.min.js');
mix.js('resources/js/poicustomization.js', 'public/dist/js/poicustomization.js');
