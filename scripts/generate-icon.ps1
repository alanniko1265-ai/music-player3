Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class NativeIcon {
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern bool DestroyIcon(IntPtr handle);
}
"@

function New-RoundedRectanglePath {
    param(
        [float]$X,
        [float]$Y,
        [float]$Width,
        [float]$Height,
        [float]$Radius
    )

    $diameter = $Radius * 2
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
    $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
    $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-MusicPlayerBitmap {
    param([int]$Size)

    $bitmap = [System.Drawing.Bitmap]::new(
        $Size,
        $Size,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.ScaleTransform($Size / 256, $Size / 256)
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $backgroundPath = New-RoundedRectanglePath -X 8 -Y 8 -Width 240 -Height 240 -Radius 34
    $backgroundBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#080A08'))
    $borderPen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#314438'), 3)
    $graphics.FillPath($backgroundBrush, $backgroundPath)
    $graphics.DrawPath($borderPen, $backgroundPath)

    $discBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#0D120F'))
    $discBorder = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#9FF7B1'), 3)
    $graphics.FillEllipse($discBrush, 45, 67, 156, 156)
    $graphics.DrawEllipse($discBorder, 45, 67, 156, 156)

    $groovePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(74, 159, 247, 177), 2)
    foreach ($inset in @(15, 27, 39, 51)) {
        $graphics.DrawEllipse($groovePen, 45 + $inset, 67 + $inset, 156 - ($inset * 2), 156 - ($inset * 2))
    }

    $labelBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#9FF7B1'))
    $holeBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#080A08'))
    $graphics.FillEllipse($labelBrush, 103, 125, 40, 40)
    $graphics.FillEllipse($holeBrush, 120, 142, 6, 6)

    $tonearmPen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#D6BD7A'), 8)
    $tonearmPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $tonearmPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $graphics.DrawLine($tonearmPen, 205, 55, 184, 86)
    $graphics.DrawLine($tonearmPen, 184, 86, 169, 133)
    $pivotBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#EEF6EF'))
    $graphics.FillEllipse($pivotBrush, 195, 45, 20, 20)

    $promptFont = [System.Drawing.Font]::new('Consolas', 37, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $promptBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#9FF7B1'))
    $graphics.DrawString('$', $promptFont, $promptBrush, 24, 18)

    $cursorBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#EEF6EF'))
    $graphics.FillRectangle($cursorBrush, 53, 42, 28, 4)

    $graphics.Dispose()
    $backgroundPath.Dispose()
    $backgroundBrush.Dispose()
    $borderPen.Dispose()
    $discBrush.Dispose()
    $discBorder.Dispose()
    $groovePen.Dispose()
    $labelBrush.Dispose()
    $holeBrush.Dispose()
    $tonearmPen.Dispose()
    $pivotBrush.Dispose()
    $promptFont.Dispose()
    $promptBrush.Dispose()
    $cursorBrush.Dispose()

    return $bitmap
}

function New-TrayIconBitmap {
    param([int]$Size)

    $bitmap = [System.Drawing.Bitmap]::new(
        $Size,
        $Size,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.ScaleTransform($Size / 64, $Size / 64)
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $discBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#07100A'))
    $discBorder = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#9FF7B1'), 4.5)
    $graphics.FillEllipse($discBrush, 6, 10, 48, 48)
    $graphics.DrawEllipse($discBorder, 6, 10, 48, 48)

    $groovePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(116, 159, 247, 177), 2)
    $graphics.DrawEllipse($groovePen, 13, 17, 34, 34)
    $graphics.DrawEllipse($groovePen, 19, 23, 22, 22)

    $labelBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#9FF7B1'))
    $holeBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#07100A'))
    $graphics.FillEllipse($labelBrush, 24, 28, 12, 12)
    $graphics.FillEllipse($holeBrush, 29, 33, 2, 2)

    $tonearmPen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#D6BD7A'), 4)
    $tonearmPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $tonearmPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $graphics.DrawLine($tonearmPen, 53, 9, 49, 18)
    $graphics.DrawLine($tonearmPen, 49, 18, 44, 33)
    $pivotBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#EEF6EF'))
    $graphics.FillEllipse($pivotBrush, 48, 4, 10, 10)

    $graphics.Dispose()
    $discBrush.Dispose()
    $discBorder.Dispose()
    $groovePen.Dispose()
    $labelBrush.Dispose()
    $holeBrush.Dispose()
    $tonearmPen.Dispose()
    $pivotBrush.Dispose()

    return $bitmap
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$publicDirectory = Join-Path $projectRoot 'public'
$pngPath = Join-Path $publicDirectory 'icon.png'
$icoPath = Join-Path $publicDirectory 'icon.ico'
$trayPath = Join-Path $publicDirectory 'tray-icon.png'
$tray2xPath = Join-Path $publicDirectory 'tray-icon@2x.png'

$pngBitmap = New-MusicPlayerBitmap -Size 512
$pngBitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
$pngBitmap.Dispose()

$iconBitmap = New-MusicPlayerBitmap -Size 256
$iconHandle = $iconBitmap.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($iconHandle)
$iconStream = [System.IO.File]::Open($icoPath, [System.IO.FileMode]::Create)

try {
    $icon.Save($iconStream)
} finally {
    $iconStream.Dispose()
    $icon.Dispose()
    [NativeIcon]::DestroyIcon($iconHandle) | Out-Null
    $iconBitmap.Dispose()
}

$trayBitmap = New-TrayIconBitmap -Size 16
$trayBitmap.Save($trayPath, [System.Drawing.Imaging.ImageFormat]::Png)
$trayBitmap.Dispose()

$tray2xBitmap = New-TrayIconBitmap -Size 32
$tray2xBitmap.Save($tray2xPath, [System.Drawing.Imaging.ImageFormat]::Png)
$tray2xBitmap.Dispose()

Get-Item $pngPath, $icoPath, $trayPath, $tray2xPath | Select-Object FullName, Length
