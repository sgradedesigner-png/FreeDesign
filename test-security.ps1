# Security Testing Script
# Run this in PowerShell

Write-Host "🔒 АЮУЛГҮЙ БАЙДЛЫН ТЕСТ ЭХЭЛЖ БАЙНА..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Email Validation
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "Тест 1: Email Validation (Буруу email хаяг)" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

$invalidEmails = @(
    "invalid-email",           # @ байхгүй
    "test@",                   # domain байхгүй
    "@example.com",           # local part байхгүй
    "test..test@example.com", # давхар цэг
    "test@.com"               # domain эхэнд цэг
)

foreach ($email in $invalidEmails) {
    Write-Host "`n🔍 Туршиж байна: $email" -ForegroundColor Cyan

    $body = @{ to = $email } | ConvertTo-Json

    try {
        # Түр хугацаагаар public endpoint ашиглана
        $response = Invoke-WebRequest -Uri "http://localhost:3000/admin/test-email" `
            -Method Post `
            -ContentType "application/json" `
            -Body $body `
            -ErrorAction Stop

        Write-Host "❌ АЛДАА: Буруу email хүлээн авагдсан байна!" -ForegroundColor Red
        Write-Host $response.Content -ForegroundColor Red
    }
    catch {
        if ($_.Exception.Response.StatusCode -eq 400) {
            Write-Host "✅ ЗӨВ: Email validation ажиллаж байна" -ForegroundColor Green
        }
        elseif ($_.Exception.Response.StatusCode -eq 401) {
            Write-Host "🔒 Authentication шаардлагатай (энэ нь зөв)" -ForegroundColor Yellow
        }
        else {
            Write-Host "⚠️  Өөр алдаа: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

Write-Host "`n" -NoNewline
Read-Host "Enter дарж үргэлжлүүлнэ үү"

# Test 2: Production Email Masking
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "Тест 2: Production Email Masking" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

Write-Host "`nЗаавар:" -ForegroundColor Cyan
Write-Host "1. Backend server logs-ыг нээнэ үү" -ForegroundColor White
Write-Host "2. NODE_ENV=production тохируулна уу" -ForegroundColor White
Write-Host "3. Дахин email илгээнэ үү" -ForegroundColor White
Write-Host "4. Logs-д 'm***@g***.com' гэх мэт mask хийгдсэн хаяг харагдах ёстой" -ForegroundColor White

Write-Host "`n💡 Одоо production mode-руу шилжих үү? (y/n): " -ForegroundColor Cyan -NoNewline
$answer = Read-Host

if ($answer -eq "y") {
    Write-Host "`n📝 .env файлд NODE_ENV=production гэж нэмнэ үү, дараа нь server-ийг restart хийнэ үү" -ForegroundColor Yellow
    Write-Host "Команд: cd backend && set NODE_ENV=production && npm run dev" -ForegroundColor Gray
}

Write-Host "`n" -NoNewline
Read-Host "Enter дарж үргэлжлүүлнэ үү"

# Test 3: Batch Limit Check
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "Тест 3: Email Batch Limit (Cron Job)" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

Write-Host "`nЗаавар:" -ForegroundColor Cyan
Write-Host "1. Database-д 50+ PENDING захиалга үүсгэнэ үү (expiring soon)" -ForegroundColor White
Write-Host "2. Manual cron trigger хийнэ үү" -ForegroundColor White
Write-Host "3. Server logs-д 'Limiting to 50 emails' гэсэн мэдээлэл гарах ёстой" -ForegroundColor White

Write-Host "`n💡 Batch limit тест хийх үү? (y/n): " -ForegroundColor Cyan -NoNewline
$answer = Read-Host

if ($answer -eq "y") {
    Write-Host "`n⚠️  Энэ тест нь database-д маш их өгөгдөл шаарддаг" -ForegroundColor Yellow
    Write-Host "Skip хийж болно - Production-д автоматаар ажиллана" -ForegroundColor Gray
}

Write-Host "`n" -NoNewline
Read-Host "Enter дарж үргэлжлүүлнэ үү"

# Test 4: XSS Protection
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "Тест 4: XSS Protection (HTML Escape)" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

Write-Host "`nЗаавар:" -ForegroundColor Cyan
Write-Host "1. Admin панелаас шинэ бүтээгдэхүүн үүсгэнэ үү" -ForegroundColor White
Write-Host "2. Нэрийг: <script>alert('XSS')</script> гэж оруулна уу" -ForegroundColor White
Write-Host "3. Захиалга үүсгэж email авна уу" -ForegroundColor White
Write-Host "4. Email дотор HTML tags escape хийгдсэн байх ёстой (&lt;script&gt;)" -ForegroundColor White

Write-Host "`n📧 Энэ тестийг хийхийг зөвлөж байна!" -ForegroundColor Green

Write-Host "`n`n" -NoNewline
Read-Host "Enter дарж дуусгах"

Write-Host "`n✅ ТЕСТҮҮД ДУУСЛАА!" -ForegroundColor Green
Write-Host "Дэлгэрэнгүй заавар доор байна..." -ForegroundColor Cyan
