# AgentManager Tray Launcher
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# ── Single instance check via Mutex ──
$mutex = New-Object System.Threading.Mutex($false, "Global\AgentManagerTray")
if (-not $mutex.WaitOne(0, $false)) {
    # Already running — bring existing window to front is not possible from here, just exit
    [System.Windows.Forms.MessageBox]::Show(
        "AgentManager 已在运行中，请检查系统托盘。",
        "AgentManager",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
    )
    $mutex.Dispose()
    exit 0
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = if ($env:PORT) { $env:PORT } else { "3000" }
$url = "http://localhost:$port"

# ── Colors (match web dark theme) ──
$bgColor     = [System.Drawing.Color]::FromArgb(17, 24, 39)     # gray-900
$cardColor   = [System.Drawing.Color]::FromArgb(31, 41, 55)     # gray-800
$borderColor = [System.Drawing.Color]::FromArgb(55, 65, 81)     # gray-700
$textColor   = [System.Drawing.Color]::FromArgb(243, 244, 246)  # gray-100
$dimColor    = [System.Drawing.Color]::FromArgb(156, 163, 175)  # gray-400
$hintColor   = [System.Drawing.Color]::FromArgb(107, 114, 128)  # gray-500
$accentColor = [System.Drawing.Color]::FromArgb(59, 130, 246)   # blue-500
$accentHover = [System.Drawing.Color]::FromArgb(37, 99, 235)    # blue-600
$greenColor  = [System.Drawing.Color]::FromArgb(34, 197, 94)    # green-500
$redColor    = [System.Drawing.Color]::FromArgb(239, 68, 68)    # red-500

# ── Tray Icon (blue square with "A") ──
$iconBmp = New-Object System.Drawing.Bitmap(16, 16)
$ig = [System.Drawing.Graphics]::FromImage($iconBmp)
$ig.Clear($accentColor)
$iFont = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$isf = New-Object System.Drawing.StringFormat
$isf.Alignment = [System.Drawing.StringAlignment]::Center
$isf.LineAlignment = [System.Drawing.StringAlignment]::Center
$ig.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
$ig.DrawString("A", $iFont, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF(0,0,16,16)), $isf)
$ig.Dispose(); $iFont.Dispose(); $isf.Dispose()
$trayIcon = [System.Drawing.Icon]::FromHandle($iconBmp.GetHicon())

# ── Start Server ──
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "node"
$psi.Arguments = "`"$scriptDir\server\dist\index.js`""
$psi.WorkingDirectory = $scriptDir
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true

$serverProcess = $null
try {
    $serverProcess = [System.Diagnostics.Process]::Start($psi)
} catch {
    [System.Windows.Forms.MessageBox]::Show("服务启动失败: $_", "AgentManager")
    exit 1
}

# ── Cleanup helper ──
function Shutdown {
    if ($serverProcess -and -not $serverProcess.HasExited) {
        Start-Process -FilePath "taskkill" -ArgumentList "/T /F /PID $($serverProcess.Id)" -NoNewWindow -Wait
    }
    $notifyIcon.Visible = $false
    $notifyIcon.Dispose()
    $iconBmp.Dispose()
    $mutex.ReleaseMutex()
    $mutex.Dispose()
    [System.Windows.Forms.Application]::Exit()
}

# ══════════════════════════════════════
#  Main Window
# ══════════════════════════════════════
$form = New-Object System.Windows.Forms.Form
$form.Text = "AgentManager"
$form.Size = New-Object System.Drawing.Size(360, 280)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedSingle"
$form.MaximizeBox = $false
$form.BackColor = $bgColor
$form.ForeColor = $textColor
$form.Icon = $trayIcon
$form.Font = New-Object System.Drawing.Font("Segoe UI", 9)

# ── Title row ──
$titleLabel = New-Object System.Windows.Forms.Label
$titleLabel.Text = "AgentManager"
$titleLabel.Font = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
$titleLabel.ForeColor = $textColor
$titleLabel.AutoSize = $true
$titleLabel.Location = New-Object System.Drawing.Point(24, 20)
$form.Controls.Add($titleLabel)

# ── Status indicator ──
$statusPanel = New-Object System.Windows.Forms.Panel
$statusPanel.Location = New-Object System.Drawing.Point(24, 62)
$statusPanel.Size = New-Object System.Drawing.Size(296, 40)
$statusPanel.BackColor = $cardColor
$form.Controls.Add($statusPanel)

$statusDot = New-Object System.Windows.Forms.Label
$statusDot.Text = [char]0x25CF  # ●
$statusDot.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$statusDot.ForeColor = $greenColor
$statusDot.Location = New-Object System.Drawing.Point(12, 10)
$statusDot.AutoSize = $true
$statusPanel.Controls.Add($statusDot)

$statusText = New-Object System.Windows.Forms.Label
$statusText.Text = "服务运行中"
$statusText.ForeColor = $dimColor
$statusText.Location = New-Object System.Drawing.Point(32, 12)
$statusText.AutoSize = $true
$statusPanel.Controls.Add($statusText)

# ── URL display ──
$urlLabel = New-Object System.Windows.Forms.Label
$urlLabel.Text = $url
$urlLabel.Font = New-Object System.Drawing.Font("Consolas", 11)
$urlLabel.ForeColor = $accentColor
$urlLabel.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
$urlLabel.Location = New-Object System.Drawing.Point(24, 116)
$urlLabel.Size = New-Object System.Drawing.Size(296, 24)
$form.Controls.Add($urlLabel)

# ── Open Browser button ──
$openBtn = New-Object System.Windows.Forms.Button
$openBtn.Text = "在浏览器中打开"
$openBtn.FlatStyle = "Flat"
$openBtn.BackColor = $accentColor
$openBtn.ForeColor = [System.Drawing.Color]::White
$openBtn.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$openBtn.Size = New-Object System.Drawing.Size(296, 38)
$openBtn.Location = New-Object System.Drawing.Point(24, 152)
$openBtn.FlatAppearance.BorderSize = 0
$openBtn.Cursor = [System.Windows.Forms.Cursors]::Hand
$openBtn.Add_Click({ Start-Process $url })
$openBtn.Add_MouseEnter({ $openBtn.BackColor = $accentHover })
$openBtn.Add_MouseLeave({ $openBtn.BackColor = $accentColor })
$form.Controls.Add($openBtn)

# ── Hint text ──
$hintLabel = New-Object System.Windows.Forms.Label
$hintLabel.Text = "关闭窗口将最小化到系统托盘"
$hintLabel.ForeColor = $hintColor
$hintLabel.Font = New-Object System.Drawing.Font("Segoe UI", 8)
$hintLabel.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
$hintLabel.Location = New-Object System.Drawing.Point(24, 202)
$hintLabel.Size = New-Object System.Drawing.Size(296, 20)
$form.Controls.Add($hintLabel)

# ── Close = minimize to tray ──
$form.Add_FormClosing({
    param($s, $e)
    if ($e.CloseReason -eq "UserClosing") {
        $e.Cancel = $true
        $form.Hide()
        $notifyIcon.ShowBalloonTip(2000, "AgentManager", "已最小化到托盘，右键可退出。", [System.Windows.Forms.ToolTipIcon]::Info)
    }
})

# ══════════════════════════════════════
#  Tray Icon
# ══════════════════════════════════════
$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Icon = $trayIcon
$notifyIcon.Text = "AgentManager - $url"
$notifyIcon.Visible = $true

$ctxMenu = New-Object System.Windows.Forms.ContextMenuStrip
$ctxMenu.BackColor = $cardColor
$ctxMenu.ForeColor = $textColor
$ctxMenu.Renderer = New-Object System.Windows.Forms.ToolStripProfessionalRenderer

$showItem = New-Object System.Windows.Forms.ToolStripMenuItem("显示窗口")
$showItem.Add_Click({ $form.Show(); $form.Activate() })

$browserItem = New-Object System.Windows.Forms.ToolStripMenuItem("在浏览器中打开")
$browserItem.Add_Click({ Start-Process $url })

$sep = New-Object System.Windows.Forms.ToolStripSeparator

$exitItem = New-Object System.Windows.Forms.ToolStripMenuItem("退出")
$exitItem.Add_Click({
    $form.Dispose()
    Shutdown
})

[void]$ctxMenu.Items.Add($showItem)
[void]$ctxMenu.Items.Add($browserItem)
[void]$ctxMenu.Items.Add($sep)
[void]$ctxMenu.Items.Add($exitItem)
$notifyIcon.ContextMenuStrip = $ctxMenu

# Double-click tray → show window
$notifyIcon.Add_DoubleClick({ $form.Show(); $form.Activate() })

# ── Server health monitor ──
$healthTimer = New-Object System.Windows.Forms.Timer
$healthTimer.Interval = 3000
$healthTimer.Add_Tick({
    if ($serverProcess -and $serverProcess.HasExited) {
        $healthTimer.Stop()
        $statusDot.ForeColor = $redColor
        $statusText.Text = "服务已停止"
        $notifyIcon.ShowBalloonTip(3000, "AgentManager", "服务进程已停止。", [System.Windows.Forms.ToolTipIcon]::Warning)
    }
})
$healthTimer.Start()

# ── Notification polling (auth prompts + task completions) ──
$script:notifiedAuthIds = @{}
$notifyTimer = New-Object System.Windows.Forms.Timer
$notifyTimer.Interval = 4000
$notifyTimer.Add_Tick({
    try {
        $wc = New-Object System.Net.WebClient
        $wc.Encoding = [System.Text.Encoding]::UTF8
        $json = $wc.DownloadString("$url/api/notifications")
        $wc.Dispose()
        $items = $json | ConvertFrom-Json
        if ($items -and $items.Count -gt 0) {
            foreach ($item in $items) {
                $id = $item.instanceId
                $name = $item.instanceName
                $type = $item.type
                if ($type -eq "auth") {
                    if (-not $script:notifiedAuthIds.ContainsKey($id)) {
                        $script:notifiedAuthIds[$id] = $true
                        $notifyIcon.ShowBalloonTip(
                            5000,
                            "AgentManager",
                            "[$name] 需要您的授权",
                            [System.Windows.Forms.ToolTipIcon]::Warning
                        )
                    }
                }
                elseif ($type -eq "taskDone") {
                    $notifyIcon.ShowBalloonTip(
                        3000,
                        "AgentManager",
                        "[$name] 任务已完成，等待输入",
                        [System.Windows.Forms.ToolTipIcon]::Info
                    )
                }
            }
        }
        # Clear resolved auth notifications
        $currentAuthIds = @{}
        if ($items) {
            foreach ($item in $items) {
                if ($item.type -eq "auth") { $currentAuthIds[$item.instanceId] = $true }
            }
        }
        $toRemove = @($script:notifiedAuthIds.Keys | Where-Object { -not $currentAuthIds.ContainsKey($_) })
        foreach ($key in $toRemove) { $script:notifiedAuthIds.Remove($key) }
    } catch {
        # Server not ready or network error — ignore
    }
})
$notifyTimer.Start()

# ── Run ──
[System.Windows.Forms.Application]::Run($form)
