<#
.SYNOPSIS
    Outlook クラシック版（デスクトップ）の受信トレイから、指定した差出人のメールを
    COM 経由で取得し、件名・受信日時・本文原文を含む Markdown レポートを出力します。

.DESCRIPTION
    Outlook が起動・ログイン済みの状態で実行してください。
    パスワードは不要です（起動中のセッションを COM で利用します）。

    差出人の絞り込みは、以下のいずれか（複数指定可）で行えます。
      -SenderEmail : 差出人メールアドレス（部分一致）
      -SenderName  : 差出人表示名（部分一致）
    社内アドレス（Exchange 内部）の場合、SenderEmailAddress が
    「/O=EXCHANGE...」という内部形式になることがあります。
    その場合は -SenderName で表示名から絞り込んでください。

.PARAMETER SenderEmail
    絞り込む差出人メールアドレス（部分一致）。例: xxx@example.com

.PARAMETER SenderName
    絞り込む差出人表示名（部分一致）。例: 山田太郎

.PARAMETER Days
    直近何日分を対象にするか。0 または未指定なら期間で絞り込みません。
    例: 7 なら過去 7 日分のみ。

.PARAMETER OutFile
    出力する Markdown ファイルのパス。既定は実行フォルダの report.md。

.PARAMETER MaxCount
    取得する最大件数。既定は 0（無制限）。

.EXAMPLE
    .\Export-OutlookMailReport.ps1 -SenderEmail "xxx@example.com"

.EXAMPLE
    .\Export-OutlookMailReport.ps1 -SenderName "山田" -Days 7 -OutFile "weekly.md"
#>

[CmdletBinding()]
param(
    [string]$SenderEmail = "",
    [string]$SenderName  = "",
    [int]$Days           = 0,
    [string]$OutFile     = "report.md",
    [int]$MaxCount       = 0
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($SenderEmail) -and [string]::IsNullOrWhiteSpace($SenderName)) {
    Write-Error "SenderEmail か SenderName のどちらかを指定してください。"
    exit 1
}

# 出力パスを絶対パスへ
if (-not [System.IO.Path]::IsPathRooted($OutFile)) {
    $OutFile = Join-Path (Get-Location).Path $OutFile
}

Write-Host "Outlook に接続しています..." -ForegroundColor Cyan

try {
    # 起動中の Outlook セッションへ接続（未起動なら COM が新規起動）
    $outlook = New-Object -ComObject Outlook.Application
    $namespace = $outlook.GetNamespace("MAPI")
    $inbox = $namespace.GetDefaultFolder(6)  # 6 = olFolderInbox（受信トレイ）
}
catch {
    Write-Error "Outlook への接続に失敗しました。Outlook を起動・ログインした状態で再実行してください。`n詳細: $($_.Exception.Message)"
    exit 1
}

# アイテムを受信日時の降順に並べ替え（新しい順）
$items = $inbox.Items
$items.Sort("[ReceivedTime]", $true)

# 期間フィルタ用のしきい値
$since = $null
if ($Days -gt 0) {
    $since = (Get-Date).AddDays(-$Days)
}

Write-Host "受信トレイを検索しています..." -ForegroundColor Cyan

$matched = New-Object System.Collections.Generic.List[object]

foreach ($m in $items) {
    # メールアイテム以外（会議招待・通知など）はスキップ
    if ($null -eq $m.MessageClass -or -not $m.MessageClass.StartsWith("IPM.Note")) {
        continue
    }

    # 期間で絞り込み（降順ソート済みなので、しきい値より古くなったら打ち切り）
    if ($null -ne $since) {
        if ($null -eq $m.ReceivedTime) { continue }
        if ($m.ReceivedTime -lt $since) { break }
    }

    # 差出人で絞り込み
    $isMatch = $true

    if (-not [string]::IsNullOrWhiteSpace($SenderEmail)) {
        $addr = ""
        try { $addr = [string]$m.SenderEmailAddress } catch { $addr = "" }
        if ($addr -notlike "*$SenderEmail*") { $isMatch = $false }
    }

    if ($isMatch -and -not [string]::IsNullOrWhiteSpace($SenderName)) {
        $name = ""
        try { $name = [string]$m.SenderName } catch { $name = "" }
        if ($name -notlike "*$SenderName*") { $isMatch = $false }
    }

    if ($isMatch) {
        $matched.Add($m)
        if ($MaxCount -gt 0 -and $matched.Count -ge $MaxCount) { break }
    }
}

Write-Host ("該当メール: {0} 件" -f $matched.Count) -ForegroundColor Green

# Markdown 本文を組み立て
$sb = New-Object System.Text.StringBuilder

$criteria = @()
if ($SenderEmail) { $criteria += "差出人アドレス: ``*$SenderEmail*``" }
if ($SenderName)  { $criteria += "差出人名: ``*$SenderName*``" }
if ($Days -gt 0)  { $criteria += "対象期間: 過去 $Days 日" }

[void]$sb.AppendLine("# メールレポート")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("- 生成日時: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
[void]$sb.AppendLine("- 抽出条件: $([string]::Join(' / ', $criteria))")
[void]$sb.AppendLine("- 該当件数: $($matched.Count) 件")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("---")
[void]$sb.AppendLine("")

foreach ($m in $matched) {
    $subject = if ($m.Subject) { $m.Subject } else { "(件名なし)" }
    $received = if ($m.ReceivedTime) { $m.ReceivedTime.ToString("yyyy-MM-dd HH:mm:ss") } else { "" }

    $fromName = ""
    $fromAddr = ""
    try { $fromName = [string]$m.SenderName } catch {}
    try { $fromAddr = [string]$m.SenderEmailAddress } catch {}

    $body = if ($m.Body) { $m.Body } else { "" }

    [void]$sb.AppendLine("## $subject")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("- 差出人: $fromName <$fromAddr>")
    [void]$sb.AppendLine("- 受信日時: $received")
    [void]$sb.AppendLine("")
    # 本文原文をそのまま（Markdown として解釈されないようコードブロックに包む）
    [void]$sb.AppendLine('```text')
    [void]$sb.AppendLine($body.TrimEnd())
    [void]$sb.AppendLine('```')
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("---")
    [void]$sb.AppendLine("")
}

# UTF-8（BOM なし）で書き出し
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($OutFile, $sb.ToString(), $utf8NoBom)

Write-Host "レポートを出力しました: $OutFile" -ForegroundColor Green

# COM オブジェクトを解放
try {
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($items) | Out-Null
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($inbox) | Out-Null
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($namespace) | Out-Null
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($outlook) | Out-Null
} catch {}
[System.GC]::Collect()
[System.GC]::WaitForPendingFinalizers()
