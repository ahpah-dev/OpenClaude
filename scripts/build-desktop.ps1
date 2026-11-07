$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Split-Path -Parent $ScriptDir
$AssetsDir = Join-Path $AppDir "assets"
New-Item -ItemType Directory -Force -Path $AssetsDir | Out-Null

Add-Type -AssemblyName System.Drawing

function New-OpenClaudeBitmap([int]$Size) {
    $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.Clear([System.Drawing.Color]::Transparent)

    $pad = [float]($Size * 0.055)
    $rectSize = [float]($Size - 2.0 * $pad)
    $radius = [float]($rectSize * 0.24)
    $diam = [float]($radius * 2.0)

    # Rounded squircle path
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($pad, $pad, $diam, $diam, 180, 90)
    $path.AddArc($pad + $rectSize - $diam, $pad, $diam, $diam, 270, 90)
    $path.AddArc($pad + $rectSize - $diam, $pad + $rectSize - $diam, $diam, $diam, 0, 90)
    $path.AddArc($pad, $pad + $rectSize - $diam, $diam, $diam, 90, 90)
    $path.CloseFigure()

    # Anthropic Terracotta gradient fill (#E18363 -> #CE6A49)
    $rectF = New-Object System.Drawing.RectangleF($pad, $pad, $rectSize, $rectSize)
    $cTop = [System.Drawing.Color]::FromArgb(255, 224, 128, 95)
    $cBot = [System.Drawing.Color]::FromArgb(255, 205, 104, 72)
    $gradBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rectF, $cTop, $cBot, 90.0)
    $g.FillPath($gradBrush, $path)

    # Subtle warm ivory inner border
    $borderWidth = [Math]::Max(1.0, [float]($Size * 0.014))
    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(55, 250, 249, 245), $borderWidth)
    $g.DrawPath($borderPen, $path)

    # 12-ray Claude starburst in warm alabaster (#FAF9F5)
    $cx = [float]($Size / 2.0)
    $cy = [float]($Size / 2.0)
    $rayColor = [System.Drawing.Color]::FromArgb(255, 250, 249, 245)
    $outerR = [float]($Size * 0.305)
    $innerR = [float]($Size * 0.055)
    $strokeW = [Math]::Max(1.6, [float]($Size * 0.056))

    $rayPen = New-Object System.Drawing.Pen($rayColor, $strokeW)
    $rayPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $rayPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    for ($i = 0; $i -lt 12; $i++) {
        $angleDeg = ($i * 30.0) - 12.0
        $rad = $angleDeg * [Math]::PI / 180.0
        # Slight organic Anthropic asymmetry on alternating rays
        $rScale = if (($i % 2) -eq 0) { 1.0 } else { 0.88 }
        $x1 = $cx + [float]([Math]::Cos($rad) * $innerR)
        $y1 = $cy + [float]([Math]::Sin($rad) * $innerR)
        $x2 = $cx + [float]([Math]::Cos($rad) * ($outerR * $rScale))
        $y2 = $cy + [float]([Math]::Sin($rad) * ($outerR * $rScale))
        $g.DrawLine($rayPen, $x1, $y1, $x2, $y2)
    }

    $centerBrush = New-Object System.Drawing.SolidBrush($rayColor)
    $hubR = [float]($Size * 0.088)
    $g.FillEllipse($centerBrush, $cx - $hubR, $cy - $hubR, $hubR * 2.0, $hubR * 2.0)

    $centerBrush.Dispose()
    $rayPen.Dispose()
    $borderPen.Dispose()
    $gradBrush.Dispose()
    $path.Dispose()
    $g.Dispose()
    return $bmp
}

# 1. Save high-res PNG icon (also copy into docs/ for landing page favicon)
$pngPath = Join-Path $AssetsDir "openclaude.png"
$bmp512 = New-OpenClaudeBitmap 512
$bmp512.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp512.Dispose()
Write-Host "[1/3] Generated PNG icon: $pngPath" -ForegroundColor Cyan

# 2. Write multi-resolution PNG-compressed Windows .ICO (256, 64, 48, 32, 16)
$icoPath = Join-Path $AssetsDir "openclaude.ico"
$sizes = @(256, 64, 48, 32, 16)
$pngBlobs = @()

foreach ($sz in $sizes) {
    $b = New-OpenClaudeBitmap $sz
    $ms = New-Object System.IO.MemoryStream
    $b.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngBlobs += ,($ms.ToArray())
    $ms.Dispose()
    $b.Dispose()
}

$fs = [System.IO.File]::Open($icoPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
$bw = New-Object System.IO.BinaryWriter($fs)

# ICONDIR header (Reserved=0, Type=1, Count=5)
$bw.Write([uint16]0)
$bw.Write([uint16]1)
$bw.Write([uint16]$sizes.Count)

$offset = 6 + (16 * $sizes.Count)
for ($i = 0; $i -lt $sizes.Count; $i++) {
    $sz = $sizes[$i]
    $blob = $pngBlobs[$i]
    $dimByte = if ($sz -ge 256) { [byte]0 } else { [byte]$sz }
    $bw.Write($dimByte)                 # bWidth
    $bw.Write($dimByte)                 # bHeight
    $bw.Write([byte]0)                  # bColorCount
    $bw.Write([byte]0)                  # bReserved
    $bw.Write([uint16]1)                # wPlanes
    $bw.Write([uint16]32)               # wBitCount
    $bw.Write([uint32]$blob.Length)     # dwBytesInRes
    $bw.Write([uint32]$offset)          # dwImageOffset
    $offset += $blob.Length
}

for ($i = 0; $i -lt $sizes.Count; $i++) {
    $bw.Write($pngBlobs[$i])
}

$bw.Flush()
$bw.Dispose()
$fs.Dispose()
Write-Host "[2/3] Generated multi-resolution Windows icon: $icoPath" -ForegroundColor Cyan

# 3. Compile native OpenClaude.exe WinForms Desktop App via .NET Framework csc.exe
$cscCandidates = @(
    "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
    "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
)
$cscExe = $cscCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $cscExe) {
    throw "Could not locate Microsoft .NET Framework csc.exe compiler."
}

$csSource = Join-Path $AppDir "desktop\OpenClaudeDesktop.cs"
$exeOut = Join-Path $AppDir "OpenClaude.exe"

& $cscExe /nologo /optimize+ /target:winexe "/win32icon:$icoPath" /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.dll "/out:$exeOut" "$csSource"
if ($LASTEXITCODE -ne 0) {
    throw "csc.exe compilation failed with exit code $LASTEXITCODE"
}

Write-Host "[3/3] Compiled native Windows desktop app: $exeOut" -ForegroundColor Green
