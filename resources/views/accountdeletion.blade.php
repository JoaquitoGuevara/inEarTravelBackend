<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Policy - In Ear Travel</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
            color: white;
            background-color: #06101f;
        }
        h1 {
            color:rgb(134, 195, 255);
            text-align: center;
            border-bottom: 2px solid #eee;
            padding-bottom: 10px;
        }
        h2 {
            color: rgb(134, 195, 255);
            margin-top: 30px;
        }
        .last-updated {
            text-align: center;
            color: lightgrey;
            font-style: italic;
            margin-bottom: 30px;
        }
        .section {
            margin-bottom: 25px;
        }
        ul, ol {
            padding-left: 25px;
        }
        li {
            margin-bottom: 10px;
        }
        .contact {
            background:rgb(5, 14, 28);
            padding: 20px;
            border-radius: 5px;
            margin-top: 30px;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 0.9em;
        }
        .form-group {
            margin-bottom: 15px;
        }
        input[type="email"], input[type="password"] {
            width: 100%;
            padding: 8px;
            margin-top: 5px;
            border-radius: 4px;
            border: 1px solid #ddd;
        }
        button {
            background-color: #dc3545;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        button:hover {
            background-color: #c82333;
        }
    </style>
</head>
<body>
    <h1>In Ear Travel</h1>

    <div class="section">
        <p>Welcome to In Ear Travel. Your privacy is important to us.</p>
    </div>

    <div class="section">
        <h2>Account deletion request</h2>
        <p>If you want to delete your account, please input your email and password below. By doing so, you agree to delete your account and all associated data including purchases associated to it.</p>
        
        <form id="deleteAccountForm" method="POST" action="/api/account/requestDeletion">
            @csrf
            <div class="form-group">
                <label for="email">Email:</label>
                <input type="email" id="email" name="email" required>
            </div>
            <div class="form-group">
                <label for="password">Password:</label>
                <input type="password" id="password" name="password" required>
            </div>
            <button type="submit">Delete My Account</button>
        </form>
    </div>
</body>
</html>
