# -----------------------------
# Paste your ?code= value here
# -----------------------------
$authCode = "e95e8ff6-2264-4536-aa38-96bcb1191593"

# Cognito info from your CDK deployment
$domain = "nail-appointment-demo-677276106309.auth.us-west-2.amazoncognito.com"
$region = "us-west-2"
$clientId = "4vukmrn941mqp0kpm6hlru4h31"
$redirectUri = "http://localhost:3000"

# Step 1: Exchange code for tokens
$headers = @{ "Content-Type" = "application/x-www-form-urlencoded" }
$body = @{
    grant_type   = "authorization_code"
    client_id    = $clientId
    code         = $authCode
    redirect_uri = $redirectUri
}

$response = Invoke-RestMethod -Uri "https://$domain/oauth2/token" -Method POST -Headers $headers -Body $body

# Step 2: Decode ID token (JWT)
function Decode-JWT($jwt) {
    $parts = $jwt -split '\.'
    $payload = $parts[1]
    $payload += '=' * (4 - ($payload.Length % 4))  # pad if necessary
    $decoded = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($payload))
    return $decoded | ConvertFrom-Json
}

$idTokenPayload = Decode-JWT $response.id_token

# Step 3: Print results
Write-Host "`n===== ID Token Payload =====`n"
$idTokenPayload | Format-List
Write-Host "`n===== Raw Response =====`n"
$response | Format-List
