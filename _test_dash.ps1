$ErrorActionPreference = "Stop"
$base = "https://handled-remember-stylishly.ngrok-free.dev/api/v1"
$stamp = Get-Date -Format "HHmmss"

# 1. Create care manager
$cmBody = @{ username="cm_d_$stamp"; password="Passw0rd!23"; confirm_password="Passw0rd!23" } | ConvertTo-Json
$cm = Invoke-RestMethod -Method Post -Uri "$base/auth/signup/care-manager" -Headers @{ "ngrok-skip-browser-warning"="true"; "Content-Type"="application/json" } -Body $cmBody
$cmTok = $cm.access_token
Write-Host "CM created"

# 2. Create patient EHR
$ehrBody = @{
    demographics = @{ name="DashTest"; date_of_birth="1992-03-15"; age=34; gender="female"; bmi=22.5; insurance_type="Private" }
    chronic_conditions = @{}
    lab_values = @{ hemoglobin=13.5; creatinine=0.8; glucose=90; wbc_count=6.5 }
    medications = @{ active_medication_count=0 }
    utilization_history = @{ previous_admissions_12m=0; previous_er_visits_12m=0 }
} | ConvertTo-Json -Depth 4
$ehr = Invoke-RestMethod -Method Post -Uri "$base/ehr/patients" -Headers @{ "ngrok-skip-browser-warning"="true"; "Content-Type"="application/json"; "Authorization"="Bearer $cmTok" } -Body $ehrBody
Write-Host "EHR created: mrn=$($ehr.mrn) patient_id=$($ehr.patient_id)"

# 3. Patient signup
$ptBody = @{ username="pt_d_$stamp"; password="Passw0rd!23"; confirm_password="Passw0rd!23"; mrn=$ehr.mrn } | ConvertTo-Json
$pt = Invoke-RestMethod -Method Post -Uri "$base/auth/signup/patient" -Headers @{ "ngrok-skip-browser-warning"="true"; "Content-Type"="application/json" } -Body $ptBody
$ptTok = $pt.access_token
Write-Host "Patient signed up, token obtained"

$authH = @{ "ngrok-skip-browser-warning"="true"; "Authorization"="Bearer $ptTok" }

# 4. /auth/me
$me = Invoke-RestMethod -Method Get -Uri "$base/auth/me" -Headers $authH
Write-Host "== /auth/me =="
Write-Host ($me | ConvertTo-Json -Compress)

# 5. /patient/dashboard
try {
    $dash = Invoke-RestMethod -Method Get -Uri "$base/patient/dashboard" -Headers $authH
    Write-Host "== /patient/dashboard =="
    Write-Host ($dash | ConvertTo-Json -Depth 4)
} catch {
    Write-Host "dashboard FAILED"
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    Write-Host $reader.ReadToEnd()
}
