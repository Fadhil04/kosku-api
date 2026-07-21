$baseUrl = "http://localhost:3000/api/v1"

# 1. Login sebagai owner
Write-Host "🔐 Login sebagai owner..." -ForegroundColor Cyan
$loginResponse = Invoke-WebRequest -Uri "$baseUrl/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body @{
    email = "owner@kosku.dev"
    password = "Password1!"
    role = "owner"
  } | ConvertFrom-Json

$token = $loginResponse.data.access_token
Write-Host "✅ Token diperoleh: $($token.Substring(0, 20))..." -ForegroundColor Green

# 2. Test GET Tenants
Write-Host "`n📋 GET /tenants..." -ForegroundColor Cyan
try {
  $tenantsResponse = Invoke-WebRequest -Uri "$baseUrl/tenants" `
    -Method GET `
    -Headers @{ Authorization = "Bearer $token" } | ConvertFrom-Json
  Write-Host "✅ Berhasil: $($tenantsResponse.data.Count) tenants" -ForegroundColor Green
  $tenantsResponse.data | ConvertTo-Json
} catch {
  Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
  $_.Exception.Response.Content | ConvertFrom-Json | ConvertTo-Json
}

# 3. Test GET Contracts
Write-Host "`n📋 GET /contracts..." -ForegroundColor Cyan
try {
  $contractsResponse = Invoke-WebRequest -Uri "$baseUrl/contracts" `
    -Method GET `
    -Headers @{ Authorization = "Bearer $token" } | ConvertFrom-Json
  Write-Host "✅ Berhasil: $($contractsResponse.data.Count) contracts" -ForegroundColor Green
  $contractsResponse.data | ConvertTo-Json
} catch {
  Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
  try {
    $_.Exception.Response.Content | ConvertFrom-Json | ConvertTo-Json
  } catch {
    Write-Host $_.Exception.Response.Content
  }
}

Write-Host "Test selesai" -ForegroundColor Yellow
