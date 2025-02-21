<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Download In Ear Travel App</title>
    <meta name="description" content="Download In Ear Travel - Your personal audio guide for Chichen Itza. Explore ancient Mayan history with expertly crafted audio tours. No tour groups, no schedules, just pure discovery on your terms.">
    <meta property="og:title" content="Download In Ear Travel - Your personal audio guide">
    <meta property="og:description" content="Turn your journey to Chichen Itza into an unforgettable experience with our offline audio guide. 2.5+ hours of engaging content about Mayan history, Mexican culture, and ancient wisdom.">
    <meta property="og:image" content="{{ mix('dist/images/iphone-mockup.png') }}">
    <meta property="og:url" content="https://ineartravel.com/download">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Download In Ear Travel App">
    <meta name="twitter:description" content="Make your Chichen Itza visit memorable with our expert audio guide. Available offline, perfect for road trips and self-guided tours.">
    <meta name="twitter:image" content="{{ mix('dist/images/iphone-mockup.png') }}">
    <style>
        body {
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background-color: #06101F;
            display: flex;
            flex-direction: column;
        }
        .download-button {
            display: block;
            transition: transform 0.2s ease;
            margin-bottom: 15px;
        }
        .download-button:hover {
            transform: scale(1.05);
        }
        .download-button img {
            width: 200px;
            height: auto;
        }
    </style>
</head>
<body>
    <a href="https://play.google.com/store/apps/details?id=com.ldkmexico.ineartravel" class="download-button" target="_blank">
        <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Get it on Google Play">
    </a>
    <a href="https://apps.apple.com/us/app/in-ear-travel/id6742119522" class="download-button" target="_blank">
        <img src="https://developer.apple.com/app-store/marketing/guidelines/images/badge-download-on-the-app-store.svg" alt="Download on the App Store">
    </a>
</body>
<script>
    (function() {
        var userAgent = navigator.userAgent || navigator.vendor || window.opera;
        
        if (/android/i.test(userAgent)) {
            window.location.href = 'https://play.google.com/store/apps/details?id=com.ldkmexico.ineartravel';
        }
        else if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
            window.location.href = 'https://apps.apple.com/us/app/in-ear-travel/id6742119522';
        }
    })();
</script>
</html>
