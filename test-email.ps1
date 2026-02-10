# PowerShell script to test email
# Usage: .\test-email.ps1 YOUR_ADMIN_TOKEN

param(
    [Parameter(Mandatory=$true)]
    [string]$Token
)

$email = "mongoldesignner@gmail.com"

Write-Host "📧 Sending test email to: $email" -ForegroundColor Cyan
Write-Host "🔑 Using token: $($Token.Substring(0, [Math]::Min(20, $Token.Length)))..." -ForegroundColor Yellow
Write-Host ""

$body = @{
    to = $email
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $Token"
}

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/admin/test-email" -Method Post -Headers $headers -Body $body
    Write-Host "✅ Success!" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10
    Write-Host ""
    Write-Host "📬 Check your email inbox: $email" -ForegroundColor Green
} catch {
    Write-Host "❌ Error:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}
