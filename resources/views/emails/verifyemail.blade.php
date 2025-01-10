<!DOCTYPE html>
<html>
<head>
    <title>Verify your email address</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
        }
        .email-container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background-color:rgb(45, 45, 45);
            color: #ffffff;
            text-align: center;
            padding: 40px;
            font-size: 24px;
            font-weight: bold;
        }
        .content {
            padding: 30px;
            text-align: center;
        }
        .content p {
            font-size: 16px;
            color: #555555;
            line-height: 1.6;
            margin-bottom: 20px;
        }
        .verify-button {
            display: inline-block;
            background-color: rgb(255, 151, 30);
            color: #ffffff;
            text-decoration: none;
            padding: 18px 36px;
            font-size: 16px;
            font-weight: bold;
            border-radius: 50px;
            margin-top: 20px;
        }
        .verify-button:hover {
            background-color: rgb(233, 136, 24);
        }
        .footer {
            background-color: #f5f5f5;
            color: #777777;
            text-align: center;
            font-size: 12px;
            padding: 10px 20px;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            Verify your email address
        </div>
        <div class="content">
            <p>To complete your account registration, you'll need to verify your email address.</p>
            <p>Please click the button below to verify your email address.</p>
            <a href="{{ $verificationLink ?? '#' }}" class="verify-button">Verify Email</a>
        </div>
        <div class="footer">
            If you did not sign up for this account, please ignore this email.
        </div>
    </div>
</body>
</html>
