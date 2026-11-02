@echo off
rem ChromeOS Flex one-click conversion. Double-click, then click "Yes" on the admin prompt.
rem The cmd part stays ASCII-only; the PowerShell part below #__PS__ is read as UTF-8.
setlocal
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
set "FRD_BAT_DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s = Get-Content -LiteralPath '%~f0' -Raw -Encoding UTF8; $i = $s.IndexOf([char]10 + '#__PS__'); Invoke-Expression $s.Substring($i + 1)"
echo.
pause
exit /b

#__PS__
# ===== 這台電腦轉 ChromeOS Flex：照 Google 官方 samples/deployment.ps1 的流程，另加檢查與先模擬再正式 =====

# ----- 設定（通常只要改這四行）-----
# 客戶的 Google 帳號有買 CEU 才填；留空＝不註冊。官方：權杖空白會安裝 Flex，但裝置不會自動註冊
$ENROLLMENT_TOKEN = ''
# 只有填了權杖才會生效。官方：onc_file「需要先定義註冊權杖」。不註冊時開機後在歡迎畫面自己選 Wi-Fi
# 有權杖但要插網路線的話，這兩行留空，會自動改寫成官方的有線網路設定
$WIFI_SSID = ''
$WIFI_PASSWORD = ''
# $true＝只跑模擬測試（只檢查、不動硬碟），結果打包到桌面傳回來給技術人員看。每種新機型的第一台都先這樣跑
# 確認沒問題再改成 $false，才會真的轉換。預設 $true：忘了改最多就是多測一次，不會誤清電腦
$ONLY_TEST = $true

$BUNDLE_URL = 'https://dl.google.com/cros-frd/frd-latest.zip'
$VECTOR_URL = 'https://packages.timber.io/vector/0.47.0/vector-0.47.0-x86_64-pc-windows-msvc.zip'
$DEPLOY_DIR = 'C:\deploy'

# 測試用開關（正式使用不要設）：換資料夾、自動回答 Y、在執行 agent.exe 之前停下
if ($env:FRD_TEST_DIR) { $DEPLOY_DIR = $env:FRD_TEST_DIR }
if ($env:FRD_TEST_TOKEN) { $ENROLLMENT_TOKEN = $env:FRD_TEST_TOKEN; $WIFI_SSID = $env:FRD_TEST_SSID; $WIFI_PASSWORD = $env:FRD_TEST_PASS }
$AUTO_YES = [bool]$env:FRD_AUTO_YES
$STOP_BEFORE_AGENT = [bool]$env:FRD_STOP_BEFORE_AGENT
$SKIP_DOWNLOAD = [bool]$env:FRD_TEST_SKIP_DOWNLOAD   # 測試用：資料夾裡已經有 agent.exe，不重新下載
if ($env:FRD_TEST_ONLY) { $ONLY_TEST = $env:FRD_TEST_ONLY -eq '1' }
# 結果包放桌面；測試時放在測試資料夾
$REPORT_DIR = if ($env:FRD_TEST_DIR) { $DEPLOY_DIR } else { [Environment]::GetFolderPath('Desktop') }

$ErrorActionPreference = 'Stop'

function Say([string]$msg, [string]$color = 'White') { Write-Host $msg -ForegroundColor $color }
# 把記錄打包成一個 zip 放桌面，對方只要傳這個檔案。不放 agent.toml、onc.json（裡面有權杖和 Wi-Fi 密碼）
function Save-Report {
    try { Stop-Transcript | Out-Null } catch {}
    $files = @(Get-ChildItem -LiteralPath $DEPLOY_DIR -File | Where-Object { $_.Name -like '*.log' -or $_.Name -eq 'convert-log.txt' })
    if (-not $files) { return }
    $zipOut = Join-Path $REPORT_DIR ('Flex結果-{0}-{1}.zip' -f $env:COMPUTERNAME, (Get-Date -Format 'MMdd-HHmm'))
    try {
        Compress-Archive -LiteralPath $files.FullName -DestinationPath $zipOut -Force
        Say ''
        Say "結果已經打包好：$zipOut" 'Cyan'
        Say '請把這個檔案傳給技術人員。'
    } catch {
        Say "打包失敗，請直接把 $DEPLOY_DIR 裡的 .log 和 convert-log.txt 傳給技術人員。" 'Yellow'
    }
}
function Fail([string]$msg, [switch]$NoReport) {
    Say ''
    Say "[停止] $msg" 'Red'
    Say 'Windows 沒有被改動，可以照常使用。' 'Yellow'
    if (-not $NoReport) { Save-Report }
    exit 1
}

# 拿這台的型號去比 Google 認證清單（answer/11513094），只提示、不擋下：
# 官方說部署前不檢查機型，不在清單上的電腦也常常轉得成功。
# Windows 回報的型號跟清單寫法常不同（Lenovo 的 Model 是機型代碼、商品名在 Version；ASUS 舊桌機可能只有主機板代號），
# 所以幾個欄位都拿來比：清單型號（去掉廠牌）的每個字依序出現在這台的欄位裡＝相符；共用含數字的字＝相近。
function Get-Words([string]$s) { @(($s.ToLower() -replace '[^a-z0-9]+', ' ').Trim() -split ' ' | Where-Object { $_ }) }
function Test-CertList($cs) {
    $log = Join-Path $DEPLOY_DIR 'cert-check.log'
    $brandMap = @{ 'asustek' = 'asus'; 'hewlett' = 'hp'; 'dell' = 'dell'; 'lenovo' = 'lenovo'; 'acer' = 'acer'; 'microsoft' = 'microsoft' }
    $brand = (Get-Words $cs.Manufacturer | Select-Object -First 1)
    if ($brandMap[$brand]) { $brand = $brandMap[$brand] }
    $prod = Get-CimInstance Win32_ComputerSystemProduct -ErrorAction SilentlyContinue
    $board = Get-CimInstance Win32_BaseBoard -ErrorAction SilentlyContinue
    $fields = @($cs.Model, $cs.SystemFamily, $prod.Version, $board.Product) | Where-Object { $_ -and $_ -notmatch '^(To be filled|System Product|Default string|Rev )' }
    if ($env:FRD_TEST_MODEL) { $fields = @($env:FRD_TEST_MODEL); $brand = $env:FRD_TEST_BRAND }
    $mine = @($fields | ForEach-Object { , (Get-Words $_) })
    try {
        if ($env:FRD_TEST_CERT_HTML) { $html = Get-Content -LiteralPath $env:FRD_TEST_CERT_HTML -Raw -Encoding UTF8 }
        else {
            [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
            $html = (Invoke-WebRequest 'https://support.google.com/chromeosflex/answer/11513094?hl=en' -UseBasicParsing -TimeoutSec 30).Content
        }
    } catch {
        Say '  認證清單：連不上 Google，型號請另外到 support.google.com/chromeosflex/answer/11513094 確認。' 'Yellow'
        "連不上清單：$($_.Exception.Message)" | Set-Content -LiteralPath $log -Encoding UTF8
        return
    }
    $rx = '<tr>\s*<td>([^<]+)</td>\s*<td>(?:<img[^>]*>)?(?:&nbsp;)?\s*([^<]+)</td>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>([^<]*)</td>'
    $best = $null; $near = @()
    foreach ($m in [regex]::Matches($html, $rx)) {
        $name = $m.Groups[1].Value.Trim()
        $w = Get-Words $name
        if ($w.Count -lt 2 -or ($brand -and $w[0] -ne $brand)) { continue }
        $mw = $w[1..($w.Count - 1)]
        foreach ($f in $mine) {
            for ($i = 0; $i -le $f.Count - $mw.Count; $i++) {
                if (($f[$i..($i + $mw.Count - 1)] -join ' ') -eq ($mw -join ' ')) {
                    if (-not $best -or $mw.Count -gt $best.Len) { $best = @{ Name = $name; Status = $m.Groups[2].Value.Trim(); Until = $m.Groups[4].Value.Trim(); Len = $mw.Count } }
                }
            }
            $shared = @($mw | Where-Object { $f -contains $_ })
            if (@($shared | Where-Object { $_ -match '\d' }).Count) { $near += [pscustomobject]@{ Name = $name; Score = $shared.Count } }
        }
    }
    $mineText = ($fields -join '／')
    if ($best) {
        $msg = "  認證清單：有，{0}（{1}，支援到 {2} 年）" -f $best.Name, $best.Status, $best.Until
        $color = if ($best.Status -eq 'Certified') { 'Green' } else { 'Yellow' }
        Say $msg $color
        if ($best.Status -eq 'Decertified') { Say '  這個型號已被 Google 除名，轉得成功也不保證之後的更新。' 'Yellow' }
    } elseif ($near) {
        $msg = "  認證清單：沒有完全相符（這台回報：$mineText），相近的有：" + (($near | Sort-Object Score -Descending | Select-Object -ExpandProperty Name -Unique | Select-Object -First 5) -join '、')
        Say $msg 'Yellow'
        Say '  請對照機身貼紙確認是不是同一款。不在清單上也可能轉得成功，但 Google 不保證。' 'Yellow'
    } else {
        $msg = "  認證清單：找不到這台（這台回報：$mineText）。不在清單上也可能轉得成功，但 Google 不保證。"
        Say $msg 'Yellow'
    }
    $msg | Set-Content -LiteralPath $log -Encoding UTF8
}

New-Item -ItemType Directory -Force -Path $DEPLOY_DIR | Out-Null
Start-Transcript -Path (Join-Path $DEPLOY_DIR 'convert-log.txt') -Append | Out-Null

Say ''
Say '==============================================' 'Cyan'
Say '   把這台電腦轉換成 ChromeOS Flex' 'Cyan'
Say '==============================================' 'Cyan'
Say ''
if ($ONLY_TEST) {
    Say '這次只做模擬測試：只檢查這台電腦能不能轉，不會改動任何東西，Windows 照常可以用。' 'Green'
    Say '跑完會在桌面產生一個結果檔，請傳給技術人員。'
} else {
    Say '轉換完成後，這台電腦的 Windows 和裡面所有資料都會被清空，無法復原。' 'Red'
}
if ($ENROLLMENT_TOKEN) {
    Say '轉完會自動註冊到貴單位的 Google 管理控制台。'
} else {
    Say '這次不註冊：轉完是一般的 ChromeOS Flex，開機後在歡迎畫面自己選 Wi-Fi、登入 Google 帳號。'
}
Say ''
if ($AUTO_YES) {
    $ans = 'Y'
} elseif ($ONLY_TEST) {
    $ans = Read-Host '要開始測試，請輸入 Y 再按 Enter'
} else {
    $ans = Read-Host '資料都備份好、確定要繼續，請輸入 Y 再按 Enter'
}
if ($ans -ne 'Y' -and $ans -ne 'y') { Fail '已取消。' -NoReport }

# ----- 1. 檢查硬體（Google 官方門檻：UEFI、GPT、32GB 以上、可用 5GB、Windows 10/11）-----
Say ''
Say '[1/5] 檢查這台電腦...' 'Cyan'
$os = (Get-CimInstance Win32_OperatingSystem).Caption
$cs = Get-CimInstance Win32_ComputerSystem
# 2026-10-07 實機（學校 ASUS SD310）：WMI 的硬碟類別不見，Get-Partition 丟「類別無效」0x80041010。
# FRD 自己也靠 WMI，這種電腦不修好轉不了，所以先用白話停下來，修法寫在手冊。
try { $disk = Get-Partition -DriveLetter C -ErrorAction Stop | Get-Disk -ErrorAction Stop }
catch {
    Say "  讀不到硬碟資訊：$($_.Exception.Message)" 'Yellow'
    Fail 'Windows 的系統資訊資料庫（WMI）異常，讀不到硬碟資訊。學校電腦常見原因是還原卡或還原軟體；修法見說明書「WMI 異常」。'
}
$freeGB = [math]::Round((Get-PSDrive C).Free / 1GB, 1)
Say ("  型號：{0} {1}" -f $cs.Manufacturer, $cs.Model)
Say ("  系統：{0}｜開機模式：{1}｜磁碟：{2}，{3}GB，可用 {4}GB" -f $os, $env:firmware_type, $disk.PartitionStyle, [math]::Round($disk.Size / 1GB), $freeGB)
if ($os -notmatch 'Windows 1[01]') { Fail '只支援 Windows 10 或 11。' }
if ($env:firmware_type -ne 'UEFI') { Fail '開機模式不是 UEFI，FRD 不支援。' }
if ("$($disk.PartitionStyle)" -ne 'GPT') { Fail '系統磁碟不是 GPT 格式，FRD 不支援。' }
if ($disk.Size / 1GB -lt 32) { Fail '系統磁碟小於 32GB。' }
# 官方寫 5GB，但同頁也寫「已知問題：部分裝置需要 9GB」；另外下載與解壓縮套件約要 3GB
if ($freeGB -lt 12) { Fail "C 槽可用空間只有 $freeGB GB，至少要 12GB（官方已知部分裝置需要 9GB＋下載套件 3GB）。" }
$power = Get-CimInstance -Namespace root/wmi -ClassName BatteryStatus -ErrorAction SilentlyContinue | Select-Object -First 1
if ($power -and -not $power.PowerOnline) { Fail '請先插上電源再執行，轉換途中斷電會讓電腦開不了機。' }
Say '  硬體條件合格。' 'Green'
try { Test-CertList $cs } catch { Say "  認證清單：比對時出錯（$($_.Exception.Message)），型號請另外確認。" 'Yellow' }

# ----- 2. 下載 FRD 套件（官方網址，不需申請）-----
Say ''
# 這個檔案旁邊（例如隨身碟）放了 frd-latest.zip／vector.zip 就直接用，不必每台都向網路下載
$localFrd = if ($env:FRD_BAT_DIR) { Join-Path $env:FRD_BAT_DIR 'frd-latest.zip' } else { '' }
$localVector = if ($env:FRD_BAT_DIR) { Join-Path $env:FRD_BAT_DIR 'vector.zip' } else { '' }
$zip = Join-Path $DEPLOY_DIR 'frd.zip'
if ($SKIP_DOWNLOAD) { Say '[2/5] [測試模式] 跳過下載' 'Yellow' } elseif ($localFrd -and (Test-Path -LiteralPath $localFrd)) {
    Say '[2/5] 使用同資料夾的 frd-latest.zip（不用上網下載）...' 'Cyan'
    Copy-Item -LiteralPath $localFrd -Destination $zip -Force
} else {
    Say '[2/5] 從 Google 下載 ChromeOS Flex（約 1GB，依網速需要幾分鐘）...' 'Cyan'
    try {
        Start-BitsTransfer -Source $BUNDLE_URL -Destination $zip -DisplayName 'ChromeOS Flex'
    } catch {
        Say '  背景下載服務不能用，改用一般下載（畫面不會顯示進度，請耐心等）...' 'Yellow'
        (New-Object System.Net.WebClient).DownloadFile($BUNDLE_URL, $zip)
    }
    Say '  下載完成。'
}
if (-not $SKIP_DOWNLOAD) {
    Say '  解壓縮中（約 1GB，請稍等）...'
    # PowerShell 5.1 的 Expand-Archive 畫進度條很耗時，關掉快很多
    $oldProgress = $ProgressPreference; $ProgressPreference = 'SilentlyContinue'
    Expand-Archive -Path $zip -DestinationPath $DEPLOY_DIR -Force
    $ProgressPreference = $oldProgress
    Remove-Item $zip
}
if (-not (Test-Path (Join-Path $DEPLOY_DIR 'agent.exe'))) { Fail '套件解壓後找不到 agent.exe，下載可能不完整，請重新執行。' }

# 記錄器（官方同款 Vector）：把執行過程存成 agent.log，失敗時才查得到原因。抓不到不影響轉換
$useVector = $false
if (-not $SKIP_DOWNLOAD) {
try {
    $vzip = Join-Path $DEPLOY_DIR 'vector.zip'
    if ($localVector -and (Test-Path -LiteralPath $localVector)) { Copy-Item -LiteralPath $localVector -Destination $vzip -Force }
    else { (New-Object System.Net.WebClient).DownloadFile($VECTOR_URL, $vzip) }
    Expand-Archive -Path $vzip -DestinationPath (Join-Path $DEPLOY_DIR 'vector') -Force
    Copy-Item (Join-Path $DEPLOY_DIR 'vector\bin\vector.exe') (Join-Path $DEPLOY_DIR 'vector.exe') -Force
    Remove-Item $vzip
    $useVector = $true
} catch {
    Say '  記錄器下載失敗，略過（不影響轉換，只是不會留下 agent.log）。' 'Yellow'
}
}

# ----- 3. 寫設定 -----
Say ''
Say '[3/5] 寫入設定...' 'Cyan'
$utf8 = New-Object System.Text.UTF8Encoding($false)
function Write-AgentConfig([bool]$dryRun) {
    $lines = @("data_dir = 'install'")
    if ($ENROLLMENT_TOKEN) {
        $lines += "enrollment_token = '$ENROLLMENT_TOKEN'"
        if ($WIFI_SSID) {
            # 用 ConvertTo-Json 產生，Wi-Fi 名稱或密碼有引號、反斜線也不會壞
            $onc = [ordered]@{
                Type = 'UnencryptedConfiguration'
                NetworkConfigurations = @([ordered]@{
                    GUID = '{' + [guid]::NewGuid().ToString() + '}'
                    Name = $WIFI_SSID
                    Type = 'WiFi'
                    WiFi = [ordered]@{ Passphrase = $WIFI_PASSWORD; SSID = $WIFI_SSID; Security = 'WPA-PSK'; AutoConnect = $true }
                })
            }
            [IO.File]::WriteAllText((Join-Path $DEPLOY_DIR 'onc.json'), ($onc | ConvertTo-Json -Depth 5), $utf8)
            $lines += "onc_file = 'onc.json'"
        } else {
            # 有權杖但沒填 Wi-Fi：當成插網路線，照官方 samples/onc/ethernet_basic.json 寫有線設定
            $onc = [ordered]@{
                Type = 'UnencryptedConfiguration'
                NetworkConfigurations = @([ordered]@{
                    GUID = '{' + [guid]::NewGuid().ToString() + '}'
                    Type = 'Ethernet'
                    Name = 'Ethernet'
                    Ethernet = [ordered]@{ Authentication = 'None' }
                })
            }
            [IO.File]::WriteAllText((Join-Path $DEPLOY_DIR 'onc.json'), ($onc | ConvertTo-Json -Depth 5), $utf8)
            $lines += "onc_file = 'onc.json'"
        }
    }
    if ($useVector) {
        $lines += "sidecar_logger_exe = 'vector.exe'"
        $lines += "sidecar_logger_args = ['--no-graceful-shutdown-limit', '--require-healthy=true', '--config', './vector.toml']"
    }
    $lines += "dry_run = $($dryRun.ToString().ToLower())"
    [IO.File]::WriteAllText((Join-Path $DEPLOY_DIR 'agent.toml'), ($lines -join "`r`n") + "`r`n", $utf8)
}
# Vector 設定照官方 deployment.ps1
$vectorConfig = @'
schema.log_namespace = true

[sources.agent]
type = "stdin"
decoding.codec = "json"

[sinks.stderr]
type = "console"
inputs = [ "agent" ]
target = "stderr"
encoding.codec = "logfmt"

[sinks.local_log_file]
type = "file"
inputs = [ "agent" ]
path = "agent.log"
encoding.codec = "logfmt"
'@
[IO.File]::WriteAllText((Join-Path $DEPLOY_DIR 'vector.toml'), $vectorConfig, $utf8)
Write-AgentConfig $true
Say '  完成。'

if ($STOP_BEFORE_AGENT) { Say '[測試模式] 停在執行 agent.exe 之前。' 'Yellow'; Stop-Transcript | Out-Null; exit 0 }

# ----- 4. 模擬測試：只檢查，不動硬碟 -----
# 官方記錄事件（answer/16390092）：檢查項目依序是 SystemChecked、TPMChecked、MemoryChecked、DiskChecked、FilesChecked；
# InstallSkipped＝「模擬測試結束，或檢查沒過、部署中止」，所以不能拿它當成功；InstallStarted＝「所有檢查都通過，開始破壞性操作」。
# 官方沒寫 agent.exe 結束代碼的意義，所以結束代碼不是 0 時保守地停下來。
$log = Join-Path $DEPLOY_DIR 'agent.log'
function Read-Log { if (Test-Path $log) { Get-Content $log -Raw -Encoding UTF8 } else { '' } }
Say ''
Say '[4/5] 模擬測試（只檢查，不會動硬碟）...' 'Cyan'
if (Test-Path $log) { Remove-Item $log }
Push-Location $DEPLOY_DIR
& .\agent.exe
$code = $LASTEXITCODE
Pop-Location
$dryLog = Read-Log
if (Test-Path $log) { Move-Item $log (Join-Path $DEPLOY_DIR 'agent-dryrun.log') -Force }
if ($dryLog) {
    # 2026-10-07 實機：DiskChecked 那行是 level=ERROR（空間不足），agent 卻回 0、五個名稱都在，
    # 以前只看名稱有沒有出現就誤判成 5/5。現在那一行不能有 level=ERROR／error=，整份也不能有 failed checks。
    $checks = 'SystemChecked', 'TPMChecked', 'MemoryChecked', 'DiskChecked', 'FilesChecked'
    $lines = $dryLog -split "`r?`n"
    $passed = @(); $failed = @()
    foreach ($c in $checks) {
        $hit = @($lines | Where-Object { $_ -match "msg=$c\b" })
        if (-not $hit) { continue }
        if ($hit | Where-Object { $_ -match 'level=ERROR|error=' }) { $failed += $c } else { $passed += $c }
    }
    Say ("  官方檢查項目通過 {0}/5：{1}" -f $passed.Count, ($passed -join '、'))
    $diskLine = $lines | Where-Object { $_ -match 'msg=DiskChecked' -and $_ -match 'insufficient disk space' } | Select-Object -First 1
    if ($diskLine -and $diskLine -match 'spaceIfWeShrink=(\d+)' ) {
        $can = [math]::Round([double]$Matches[1] / 1GB, 1)
        $need = if ($diskLine -match 'spaceRequired=(\d+)') { [math]::Round([double]$Matches[1] / 1GB, 1) } else { '?' }
        Fail "C 槽最多只能縮出 $can GB，FRD 需要 $need GB。C 槽可用空間雖然夠，但分頁檔、休眠檔、還原點卡在尾端搬不動；先雙擊同資料夾的「清出C槽空間.bat」（會自動處理並重開機一次），再重跑模擬。"
    }
    if ($failed) { Fail ('模擬測試沒通過：{0} 有錯誤，看結果檔裡的 agent-dryrun.log。' -f ($failed -join '、')) }
    if ($passed.Count -lt 5 -or $dryLog -match 'failed checks') { Fail '模擬測試沒有通過全部檢查，看結果檔裡的 agent-dryrun.log。' }
}
if ($code -ne 0) { Fail "模擬測試回報錯誤（代碼 $code）。" }
Say '  模擬測試完成。' 'Green'

if ($ONLY_TEST) {
    Say ''
    Say '這次只做模擬測試，到這裡結束。硬碟完全沒有被動到，Windows 照常可以用。' 'Green'
    Save-Report
    Say '技術人員確認沒問題後，會給你正式轉換用的檔案。'
    exit 0
}

# ----- 5. 正式轉換 -----
# FRD 正式模式也會自己再跑一次全部檢查，沒過就中止（InstallSkipped），不會動硬碟。
Say ''
Say '[5/5] 開始正式轉換。過程中不要關機、不要拔電源。' 'Yellow'
Write-AgentConfig $false
Push-Location $DEPLOY_DIR
& .\agent.exe
$code = $LASTEXITCODE
Pop-Location
$realLog = Read-Log
Say ''
if ($realLog -match 'InstallStarted') {
    Say '轉換已經開始：電腦會重新開機，進入 ChromeOS Flex 安裝。' 'Green'
    Say '重新開機後的安裝不需要網路，也不用按任何東西，等它自己完成。'
    Say '如果 2 分鐘內都沒有自動重新開機，請手動重新開機一次。'
} elseif ($realLog -match 'InstallSkipped') {
    Fail '正式執行前的檢查沒有通過，FRD 自己中止了，硬碟沒有被動到。'
} else {
    Say "沒有讀到執行記錄（代碼 $code），無法判斷結果。請先不要關機。" 'Yellow'
    Save-Report
    exit 1
}
Stop-Transcript | Out-Null
