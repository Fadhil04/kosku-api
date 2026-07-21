$baseUrl = "http://localhost:3000/api/v1"

# 1. Login sebagai owner
Write-Host "Login sebagai owner..." -ForegroundColor Cyan
$loginResponse = Invoke-WebRequest -Uri "$baseUrl/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body (@{
    email = "owner@kosku.dev"
    password = "Password1!"
    role = "owner"
  } | ConvertTo-Json) | ConvertFrom-Json

$token = $loginResponse.data.access_token
Write-Host "Token diperoleh" -ForegroundColor Green

# 2. Test GET Tenants
Write-Host "Testing GET /tenants..." -ForegroundColor Cyan
try {
  $tenantsResponse = Invoke-WebRequest -Uri "$baseUrl/tenants" `
    -Method GET `
    -Headers @{ Authorization = "Bearer $token" } | ConvertFrom-Json
  Write-Host "OK: Tenants found" -ForegroundColor Green
  Write-Output $tenantsResponse
} catch {
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  Write-Output $_.Exception.Response.Content
}

# 3. Test GET Contracts
Write-Host "Testing GET /contracts..." -ForegroundColor Cyan
try {
  $contractsResponse = Invoke-WebRequest -Uri "$baseUrl/contracts" `
    -Method GET `
    -Headers @{ Authorization = "Bearer $token" } | ConvertFrom-Json
  Write-Host "OK: Contracts found" -ForegroundColor Green
  Write-Output $contractsResponse
} catch {
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  Write-Output $_.Exception.Response.Content
}

Write-Host "Test complete" -ForegroundColor Yellow
