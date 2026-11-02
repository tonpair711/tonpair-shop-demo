@echo off
rem Free up shrinkable space on C: so ChromeOS Flex FRD can create its partition. Double-click, then click "Yes".
rem The cmd part stays ASCII-only; the PowerShell part below #__PS__ is read as UTF-8.
setlocal
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
set "SPACE_BAT=%~f0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s = Get-Content -LiteralPath '%~f0' -Raw -Encoding UTF8; $i = $s.IndexOf([char]10 + '#__PS__'); Invoke-Expression $s.Substring($i + 1)"
echo.
pause
exit /b

#__PS__
# ===== 清出 C 槽可縮小的空間，給 FRD 切安裝分割區 =====
# 2026-10-07 實機（學校 ASUS SD310，120GB SSD）：C 槽可用 12GB 以上，FRD 卻只縮得出 2.1GB（要 5GB），
# 原因是分頁檔、休眠檔、還原點卡在分割區尾端搬不動。這支照手冊「縮不出空間怎麼辦」的步驟自動做。
# 分頁檔要重開機後才真的消失，所以分兩段：第一段改設定、設好開機後自動再跑一次、重開機；第二段整理空間再量。
# 可縮 GB 用 Get-PartitionSupportedSize 量，跟 FRD 記錄裡的 systemPartitionMin 是同一個數字。

$NEED_GB = 6          # FRD 要約 5.4GB（spaceRequired 5372903424），多留一點
$ErrorActionPreference = 'Stop'
$DIR = 'C:\deploy'
$mark = Join-Path $DIR 'space-phase2.txt'
$runOnceKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce'

function Say([string]$msg, [string]$color = 'White') { Write-Host $msg -ForegroundColor $color }
# 測試用：設 SPACE_TEST_GB 時假裝可縮這麼多，所有會改設定的步驟只印出來不執行、不重開機
$TEST = [bool]$env:SPACE_TEST_GB
function Step([string]$what, [scriptblock]$do) { if ($TEST) { Say "  [測試] 略過：$what" 'Yellow' } else { & $do } }
function Get-ShrinkGB {
    if ($TEST) { return [double]$env:SPACE_TEST_GB }
    $p = Get-Partition -DriveLetter C
    $s = Get-PartitionSupportedSize -DriveLetter C
    [math]::Round(($p.Size - $s.SizeMin) / 1GB, 1)
}
# 重組工具會在「應用程式」記錄寫事件 259：最後一個搬不動的檔案是誰，縮不夠時拿來判斷卡在哪
function Show-Blocker {
    $e = Get-WinEvent -FilterHashtable @{ LogName = 'Application'; ProviderName = 'Microsoft-Windows-Defrag'; Id = 259 } -MaxEvents 1 -ErrorAction SilentlyContinue
    if ($e) { Say ('  卡住的檔案（Windows 重組記錄）：' + ($e.Message -replace '\s+', ' ')) 'Yellow' }
}
function Done([double]$gb) {
    if ($gb -ge $NEED_GB) {
        Say ''
        Say "可以縮出 $gb GB，夠了。接著跑「一鍵轉換Flex-模擬.bat」。" 'Green'
    } else {
        Say ''
        Say "目前只能縮出 $gb GB，還不夠（要 $NEED_GB GB）。" 'Red'
        Show-Blocker
        Say '  可以再做：開始 → 輸入「磁碟清理」→ 選 C 槽 →「清理系統檔」全部勾選，之後再雙擊這個檔案一次。'
        Say '  還是不夠就把畫面拍給技術人員。'
    }
    Stop-Transcript | Out-Null
    exit 0
}

New-Item -ItemType Directory -Force -Path $DIR | Out-Null
Start-Transcript -Path (Join-Path $DIR 'space-log.txt') -Append | Out-Null

Say ''
Say '==============================================' 'Cyan'
Say '   清出 C 槽空間（給 ChromeOS Flex 轉換用）' 'Cyan'
Say '==============================================' 'Cyan'
Say '只改 Windows 的設定（休眠、還原點、分頁檔），不會刪你的檔案。'
Say ''

try { $gb = Get-ShrinkGB }
catch { Say "讀不到 C 槽資訊：$($_.Exception.Message)" 'Red'; Say '這是 WMI 異常，先照說明書「修 WMI」處理。' 'Yellow'; exit 1 }
Say "目前 C 槽最多可以縮出：$gb GB（要 $NEED_GB GB 以上）"

if (-not (Test-Path $mark)) {
    if ($gb -ge $NEED_GB) { Done $gb }

    # ----- 第一段：改設定 -----
    Say ''
    Say '[1/3] 關閉休眠（刪掉休眠檔）...' 'Cyan'
    Step 'powercfg /h off' { cmd /c 'powercfg /h off' }
    Say '[2/3] 刪除還原點、停用系統還原...' 'Cyan'
    # 沒有還原點時 vssadmin 會往錯誤輸出寫一行，交給 cmd 丟掉，免得被當成例外中斷
    Step 'vssadmin delete shadows' { cmd /c 'vssadmin delete shadows /for=C: /all /quiet >nul 2>&1' }
    Step 'Disable-ComputerRestore' { try { Disable-ComputerRestore -Drive 'C:\' } catch {} }
    Say '[3/3] 暫時不用分頁檔...' 'Cyan'
    Step '關掉自動管理分頁檔、刪除分頁檔設定' {
        $cs = Get-CimInstance Win32_ComputerSystem
        if ($cs.AutomaticManagedPagefile) { Set-CimInstance -InputObject $cs -Property @{ AutomaticManagedPagefile = $false } }
        Get-CimInstance Win32_PageFileSetting | Remove-CimInstance
    }

    # 不能用 Test-Path：使用中的 pagefile.sys 它會回 False（2026-10-07 實測），改看「目前正在用的分頁檔」
    if (Get-CimInstance Win32_PageFileUsage | Where-Object { $_.Name -like 'C:*' }) {
        # 分頁檔要重開機才會消失：設定登入後自動再跑一次這個檔案（會再問一次「是否允許」）
        Step '設定開機後自動再跑一次' {
            Set-Content -LiteralPath $mark -Value (Get-Date -Format s) -Encoding ASCII
            New-Item -Path $runOnceKey -Force | Out-Null
            Set-ItemProperty -Path $runOnceKey -Name 'FlexFreeSpace' -Value ('cmd /c "' + $env:SPACE_BAT + '"')
        }
        Say ''
        Say '設定改好了，要重新開機才會生效。' 'Green'
        Say '重開機登入後，這個檔案會自動再跑一次（跳出「是否允許」時按「是」），接著整理空間。'
        $ans = Read-Host '要現在重新開機，請輸入 Y 再按 Enter（先存好其他開著的檔案）'
        Stop-Transcript | Out-Null
        if ($ans -eq 'Y' -or $ans -eq 'y') { Step '重新開機' { shutdown /r /t 5 } } else { Say '之後自己重新開機也可以，開機後一樣會自動接著跑。' 'Yellow' }
        exit 0
    }
}

# ----- 第二段：整理空間再量 -----
Remove-Item -LiteralPath $mark -ErrorAction SilentlyContinue
Remove-ItemProperty -Path $runOnceKey -Name 'FlexFreeSpace' -ErrorAction SilentlyContinue
Say ''
Say '整理 C 槽可用空間（舊硬碟可能要十幾分鐘，請不要關掉視窗）...' 'Cyan'
Step 'defrag C: /X' { defrag C: /X /U }
$gb = Get-ShrinkGB
Say "整理後最多可以縮出：$gb GB"
if ($gb -lt $NEED_GB) {
    # /X 在固態硬碟上不一定有效，再用傳統重組搬一次
    Say '還不夠，再做一次完整重組...' 'Cyan'
    Step 'defrag C: /D' { defrag C: /D /U }
    $gb = Get-ShrinkGB
}
Done $gb
