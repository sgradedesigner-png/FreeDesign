# Run All Load Tests Script
# This script runs all load tests in sequence

$K6_PATH = "C:\Program Files\k6\k6.exe"
$SCRIPT_DIR = $PSScriptRoot

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  Load Testing Suite - k6" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if k6 is installed
if (-not (Test-Path $K6_PATH)) {
    Write-Host "❌ k6 not found at $K6_PATH" -ForegroundColor Red
    Write-Host "Please install k6: winget install k6" -ForegroundColor Yellow
    exit 1
}

# Check if backend is running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:4000/health" -TimeoutSec 5 -UseBasicParsing
    Write-Host "✅ Backend is running on http://localhost:4000" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend is not running!" -ForegroundColor Red
    Write-Host "Please start the backend: npm run dev" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Starting load tests..." -ForegroundColor Cyan
Write-Host ""

# Function to run a test
function Run-Test {
    param (
        [string]$TestName,
        [string]$TestFile,
        [string]$Duration
    )

    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
    Write-Host "🧪 Running: $TestName" -ForegroundColor Yellow
    Write-Host "⏱️  Duration: $Duration" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
    Write-Host ""

    $startTime = Get-Date
    & $K6_PATH run "$SCRIPT_DIR\scenarios\$TestFile"
    $endTime = Get-Date
    $elapsed = $endTime - $startTime

    Write-Host ""
    Write-Host "✅ $TestName completed in $($elapsed.ToString('mm\:ss'))" -ForegroundColor Green
    Write-Host ""
}

# Run tests in sequence
$tests = @(
    @{Name="Smoke Test"; File="smoke-test.js"; Duration="1 minute"},
    @{Name="API Endpoints Test"; File="api-endpoints-test.js"; Duration="5 minutes"},
    @{Name="Load Test"; File="load-test.js"; Duration="10 minutes"},
    @{Name="Spike Test"; File="spike-test.js"; Duration="5 minutes"}
    # Uncomment to include stress test (takes longer)
    # @{Name="Stress Test"; File="stress-test.js"; Duration="15 minutes"}
)

$totalStartTime = Get-Date

foreach ($test in $tests) {
    Run-Test -TestName $test.Name -TestFile $test.File -Duration $test.Duration

    # Short pause between tests
    Write-Host "⏸️  Pausing for 10 seconds before next test..." -ForegroundColor Cyan
    Start-Sleep -Seconds 10
    Write-Host ""
}

$totalEndTime = Get-Date
$totalElapsed = $totalEndTime - $totalStartTime

Write-Host "==================================" -ForegroundColor Green
Write-Host "  All Tests Completed!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host "Total time: $($totalElapsed.ToString('hh\:mm\:ss'))" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Check results in: load-tests\results\" -ForegroundColor Cyan
Write-Host ""

