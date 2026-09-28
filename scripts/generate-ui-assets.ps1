param(
  [string]$OutputRoot = (Join-Path $PSScriptRoot '..\assets')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$C = @{
  Navy      = [System.Drawing.Color]::FromArgb(255, 22, 42, 74)
  Navy2     = [System.Drawing.Color]::FromArgb(255, 34, 61, 99)
  Blue      = [System.Drawing.Color]::FromArgb(255, 48, 156, 232)
  BlueLight = [System.Drawing.Color]::FromArgb(255, 213, 240, 255)
  Green     = [System.Drawing.Color]::FromArgb(255, 43, 190, 111)
  GreenDark = [System.Drawing.Color]::FromArgb(255, 22, 139, 78)
  Yellow    = [System.Drawing.Color]::FromArgb(255, 255, 191, 52)
  Amber     = [System.Drawing.Color]::FromArgb(255, 235, 149, 31)
  Red       = [System.Drawing.Color]::FromArgb(255, 232, 79, 79)
  RedDark   = [System.Drawing.Color]::FromArgb(255, 178, 48, 55)
  Purple    = [System.Drawing.Color]::FromArgb(255, 126, 88, 214)
  Cream     = [System.Drawing.Color]::FromArgb(255, 255, 249, 236)
  White     = [System.Drawing.Color]::White
  Gray      = [System.Drawing.Color]::FromArgb(255, 137, 151, 169)
  LightGray = [System.Drawing.Color]::FromArgb(255, 229, 236, 244)
  Mint      = [System.Drawing.Color]::FromArgb(255, 224, 248, 240)
}

function Ensure-Dir([string]$Path) {
  [System.IO.Directory]::CreateDirectory($Path) | Out-Null
}

function New-Canvas([int]$Width, [int]$Height, [System.Drawing.Color]$Background = [System.Drawing.Color]::Transparent) {
  $bmp = [System.Drawing.Bitmap]::new($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear($Background)
  $g.Dispose()
  return $bmp
}

function Get-Gfx([System.Drawing.Bitmap]$Bmp) {
  $g = [System.Drawing.Graphics]::FromImage($Bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  return $g
}

function Round-Path([float]$X,[float]$Y,[float]$W,[float]$H,[float]$R) {
  $p = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $d = $R * 2
  $p.AddArc($X,$Y,$d,$d,180,90)
  $p.AddArc($X+$W-$d,$Y,$d,$d,270,90)
  $p.AddArc($X+$W-$d,$Y+$H-$d,$d,$d,0,90)
  $p.AddArc($X,$Y+$H-$d,$d,$d,90,90)
  $p.CloseFigure()
  return $p
}

function Draw-Round([System.Drawing.Graphics]$G,[float]$X,[float]$Y,[float]$W,[float]$H,[float]$R,[System.Drawing.Color]$Fill,[System.Drawing.Color]$Stroke,[float]$StrokeWidth=4) {
  $p = Round-Path $X $Y $W $H $R
  $b = [System.Drawing.SolidBrush]::new($Fill)
  $G.FillPath($b,$p)
  $b.Dispose()
  if ($StrokeWidth -gt 0) {
    $pen = [System.Drawing.Pen]::new($Stroke,$StrokeWidth)
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $G.DrawPath($pen,$p)
    $pen.Dispose()
  }
  $p.Dispose()
}

function Draw-ShadowCard([System.Drawing.Graphics]$G,[float]$X,[float]$Y,[float]$W,[float]$H,[float]$R,[System.Drawing.Color]$Fill,[System.Drawing.Color]$Stroke) {
  Draw-Round $G ($X+10) ($Y+16) $W $H $R ([System.Drawing.Color]::FromArgb(35,16,42,74)) ([System.Drawing.Color]::Transparent) 0
  Draw-Round $G $X $Y $W $H $R $Fill $Stroke 5
}

function New-Font([float]$Size,[System.Drawing.FontStyle]$Style=[System.Drawing.FontStyle]::Regular) {
  return [System.Drawing.Font]::new('Segoe UI',$Size,$Style,[System.Drawing.GraphicsUnit]::Pixel)
}

function Draw-Text([System.Drawing.Graphics]$G,[string]$Text,[System.Drawing.RectangleF]$Rect,[float]$Size,[System.Drawing.Color]$Color,[System.Drawing.FontStyle]$Style=[System.Drawing.FontStyle]::Regular,[string]$Align='Center') {
  $font = New-Font $Size $Style
  $brush = [System.Drawing.SolidBrush]::new($Color)
  $sf = [System.Drawing.StringFormat]::new()
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  if ($Align -eq 'Left') { $sf.Alignment = [System.Drawing.StringAlignment]::Near }
  elseif ($Align -eq 'Right') { $sf.Alignment = [System.Drawing.StringAlignment]::Far }
  else { $sf.Alignment = [System.Drawing.StringAlignment]::Center }
  $G.DrawString($Text,$font,$brush,$Rect,$sf)
  $sf.Dispose(); $brush.Dispose(); $font.Dispose()
}

function Save-Asset([System.Drawing.Bitmap]$Bmp,[string]$RelativePath) {
  $full = Join-Path $OutputRoot $RelativePath
  Ensure-Dir ([System.IO.Path]::GetDirectoryName($full))
  $Bmp.Save($full,[System.Drawing.Imaging.ImageFormat]::Png)
  $Bmp.Dispose()
}

function Draw-Arrow([System.Drawing.Graphics]$G,[float]$X,[float]$Y,[float]$Scale,[System.Drawing.Color]$Color,[bool]$Left=$false) {
  $pen = [System.Drawing.Pen]::new($Color,14*$Scale)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  if ($Left) {
    $G.DrawLine($pen,$X+70*$Scale,$Y+50*$Scale,$X+15*$Scale,$Y+50*$Scale)
    $G.DrawLines($pen,[System.Drawing.PointF[]]@([System.Drawing.PointF]::new($X+38*$Scale,$Y+22*$Scale),[System.Drawing.PointF]::new($X+12*$Scale,$Y+50*$Scale),[System.Drawing.PointF]::new($X+38*$Scale,$Y+78*$Scale)))
  } else {
    $G.DrawLine($pen,$X+10*$Scale,$Y+50*$Scale,$X+65*$Scale,$Y+50*$Scale)
    $G.DrawLines($pen,[System.Drawing.PointF[]]@([System.Drawing.PointF]::new($X+42*$Scale,$Y+22*$Scale),[System.Drawing.PointF]::new($X+68*$Scale,$Y+50*$Scale),[System.Drawing.PointF]::new($X+42*$Scale,$Y+78*$Scale)))
  }
  $pen.Dispose()
}

function Draw-Check([System.Drawing.Graphics]$G,[float]$X,[float]$Y,[float]$Scale,[System.Drawing.Color]$Color) {
  $pen=[System.Drawing.Pen]::new($Color,18*$Scale); $pen.StartCap='Round'; $pen.EndCap='Round'; $pen.LineJoin='Round'
  $G.DrawLines($pen,[System.Drawing.PointF[]]@([System.Drawing.PointF]::new($X,$Y+38*$Scale),[System.Drawing.PointF]::new($X+28*$Scale,$Y+66*$Scale),[System.Drawing.PointF]::new($X+82*$Scale,$Y)))
  $pen.Dispose()
}

function Draw-Cross([System.Drawing.Graphics]$G,[float]$X,[float]$Y,[float]$Scale,[System.Drawing.Color]$Color) {
  $pen=[System.Drawing.Pen]::new($Color,18*$Scale); $pen.StartCap='Round'; $pen.EndCap='Round'
  $G.DrawLine($pen,$X,$Y,$X+70*$Scale,$Y+70*$Scale); $G.DrawLine($pen,$X+70*$Scale,$Y,$X,$Y+70*$Scale); $pen.Dispose()
}

function Star-Points([float]$Cx,[float]$Cy,[float]$Outer,[float]$Inner) {
  $pts = [System.Collections.Generic.List[System.Drawing.PointF]]::new()
  for($i=0;$i -lt 10;$i++) {
    $r = if($i%2 -eq 0){$Outer}else{$Inner}; $a=(-90+$i*36)*[Math]::PI/180
    $pts.Add([System.Drawing.PointF]::new($Cx+[float]([Math]::Cos($a)*$r),$Cy+[float]([Math]::Sin($a)*$r)))
  }
  return $pts.ToArray()
}

function Draw-Star([System.Drawing.Graphics]$G,[float]$Cx,[float]$Cy,[float]$R,[System.Drawing.Color]$Fill,[System.Drawing.Color]$Stroke) {
  $pts=Star-Points $Cx $Cy $R ($R*.46)
  $b=[System.Drawing.SolidBrush]::new($Fill); $p=[System.Drawing.Pen]::new($Stroke,[Math]::Max(3,$R*.08)); $p.LineJoin='Round'
  $G.FillPolygon($b,$pts); $G.DrawPolygon($p,$pts); $b.Dispose(); $p.Dispose()
}

function Draw-ClueIcon([System.Drawing.Graphics]$G,[string]$Kind,[System.Drawing.RectangleF]$R) {
  $x=$R.X; $y=$R.Y; $w=$R.Width; $h=$R.Height; $s=[Math]::Min($w,$h)/100
  switch($Kind) {
    'source' {
      Draw-Round $G ($x+7*$s) ($y+12*$s) (86*$s) (76*$s) (12*$s) $C.White $C.Navy (5*$s)
      $b=[System.Drawing.SolidBrush]::new($C.Blue); $G.FillEllipse($b,$x+16*$s,$y+23*$s,28*$s,28*$s); $b.Dispose()
      $b=[System.Drawing.SolidBrush]::new($C.LightGray); $G.FillRectangle($b,$x+52*$s,$y+27*$s,30*$s,6*$s); $G.FillRectangle($b,$x+52*$s,$y+42*$s,24*$s,6*$s); $b.Dispose()
      $b=[System.Drawing.SolidBrush]::new($C.Green); $G.FillEllipse($b,$x+60*$s,$y+57*$s,25*$s,25*$s); $b.Dispose(); Draw-Check $G ($x+66*$s) ($y+63*$s) (.18*$s) $C.White
    }
    'date' {
      Draw-Round $G ($x+12*$s) ($y+10*$s) (76*$s) (82*$s) (12*$s) $C.White $C.Navy (5*$s)
      $b=[System.Drawing.SolidBrush]::new($C.Red); $G.FillRectangle($b,$x+13*$s,$y+25*$s,74*$s,20*$s); $b.Dispose()
      $p=[System.Drawing.Pen]::new($C.Gray,3*$s); for($i=0;$i -lt 3;$i++){for($j=0;$j -lt 2;$j++){$G.DrawRectangle($p,$x+(24+$i*20)*$s,$y+(55+$j*18)*$s,9*$s,9*$s)}}; $p.Dispose()
    }
    'image' {
      Draw-Round $G ($x+8*$s) ($y+14*$s) (84*$s) (70*$s) (12*$s) $C.White $C.Navy (5*$s)
      $b=[System.Drawing.SolidBrush]::new($C.Yellow); $G.FillEllipse($b,$x+21*$s,$y+26*$s,15*$s,15*$s); $b.Dispose()
      $b=[System.Drawing.SolidBrush]::new($C.Green); $G.FillPolygon($b,[System.Drawing.PointF[]]@([System.Drawing.PointF]::new($x+15*$s,$y+75*$s),[System.Drawing.PointF]::new($x+42*$s,$y+46*$s),[System.Drawing.PointF]::new($x+58*$s,$y+62*$s),[System.Drawing.PointF]::new($x+70*$s,$y+49*$s),[System.Drawing.PointF]::new($x+86*$s,$y+75*$s))); $b.Dispose()
      $p=[System.Drawing.Pen]::new($C.Blue,6*$s); $G.DrawEllipse($p,$x+58*$s,$y+57*$s,28*$s,28*$s); $G.DrawLine($p,$x+80*$s,$y+80*$s,$x+94*$s,$y+94*$s); $p.Dispose()
    }
    'urgent' {
      $b=[System.Drawing.SolidBrush]::new($C.Red); $G.FillPolygon($b,[System.Drawing.PointF[]]@([System.Drawing.PointF]::new($x+50*$s,$y+6*$s),[System.Drawing.PointF]::new($x+95*$s,$y+88*$s),[System.Drawing.PointF]::new($x+5*$s,$y+88*$s))); $b.Dispose()
      Draw-Text $G '!' ([System.Drawing.RectangleF]::new($x+20*$s,$y+24*$s,60*$s,56*$s)) (52*$s) $C.White ([System.Drawing.FontStyle]::Bold)
    }
  }
}

function Make-ClueIcon([string]$Name,[string]$Kind) {
  $bmp=New-Canvas 512 512; $g=Get-Gfx $bmp
  Draw-Round $g 42 42 428 428 110 ([System.Drawing.Color]::FromArgb(245,255,255,255)) ([System.Drawing.Color]::FromArgb(110,184,218,239)) 10
  Draw-ClueIcon $g $Kind ([System.Drawing.RectangleF]::new(106,106,300,300))
  $g.Dispose(); Save-Asset $bmp ('icons\'+$Name)
}

function Make-MiniIcon([string]$Name,[string]$Kind,[System.Drawing.Color]$Color) {
  $bmp=New-Canvas 512 512; $g=Get-Gfx $bmp
  switch($Kind) {
    'check' { $b=[System.Drawing.SolidBrush]::new($Color); $g.FillEllipse($b,46,46,420,420); $b.Dispose(); Draw-Check $g 145 218 2.6 $C.White }
    'cross' { $b=[System.Drawing.SolidBrush]::new($Color); $g.FillEllipse($b,46,46,420,420); $b.Dispose(); Draw-Cross $g 170 170 2.5 $C.White }
    'question' { $b=[System.Drawing.SolidBrush]::new($Color); $g.FillEllipse($b,46,46,420,420); $b.Dispose(); Draw-Text $g '?' ([System.Drawing.RectangleF]::new(46,30,420,420)) 290 $C.White ([System.Drawing.FontStyle]::Bold) }
    'warning' { $b=[System.Drawing.SolidBrush]::new($Color); $g.FillPolygon($b,[System.Drawing.PointF[]]@([System.Drawing.PointF]::new(256,38),[System.Drawing.PointF]::new(474,444),[System.Drawing.PointF]::new(38,444))); $b.Dispose(); Draw-Text $g '!' ([System.Drawing.RectangleF]::new(110,142,292,250)) 220 $C.Navy ([System.Drawing.FontStyle]::Bold) }
    'arrow' { Draw-Arrow $g 72 136 4.2 $Color }
    'back' { Draw-Arrow $g 72 136 4.2 $Color $true }
    'share' { $pen=[System.Drawing.Pen]::new($Color,28); $pen.StartCap='Round'; $pen.EndCap='Round'; $g.DrawLine($pen,155,256,342,150); $g.DrawLine($pen,155,256,342,362); $pen.Dispose(); $b=[System.Drawing.SolidBrush]::new($Color); $g.FillEllipse($b,90,191,130,130); $g.FillEllipse($b,292,82,130,130); $g.FillEllipse($b,292,300,130,130); $b.Dispose() }
    'search' { $pen=[System.Drawing.Pen]::new($Color,34); $pen.StartCap='Round'; $g.DrawEllipse($pen,82,72,250,250); $g.DrawLine($pen,292,294,427,430); $pen.Dispose() }
    'wrench' { $pen=[System.Drawing.Pen]::new($Color,50); $pen.StartCap='Round'; $pen.EndCap='Round'; $g.DrawLine($pen,146,367,361,151); $pen.Dispose(); $b=[System.Drawing.SolidBrush]::new($Color); $g.FillEllipse($b,70,321,130,130); $g.FillPie($b,294,66,154,154,35,290); $b.Dispose(); $b=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::Transparent); $g.FillEllipse($b,112,363,46,46); $b.Dispose() }
    'starFull' { Draw-Star $g 256 256 205 $Color ([System.Drawing.Color]::FromArgb(255,205,129,17)) }
    'starEmpty' { Draw-Star $g 256 256 205 ([System.Drawing.Color]::FromArgb(255,247,250,253)) $Color }
    'sound' { $b=[System.Drawing.SolidBrush]::new($Color); $g.FillPolygon($b,[System.Drawing.PointF[]]@([System.Drawing.PointF]::new(76,208),[System.Drawing.PointF]::new(169,208),[System.Drawing.PointF]::new(290,107),[System.Drawing.PointF]::new(290,405),[System.Drawing.PointF]::new(169,304),[System.Drawing.PointF]::new(76,304))); $b.Dispose(); $p=[System.Drawing.Pen]::new($Color,24); $g.DrawArc($p,255,151,145,210,-60,120); $g.DrawArc($p,247,101,230,310,-60,120); $p.Dispose() }
    'settings' { $p=[System.Drawing.Pen]::new($Color,34); $g.DrawEllipse($p,128,128,256,256); $g.DrawEllipse($p,211,211,90,90); for($i=0;$i -lt 8;$i++){ $a=$i*45*[Math]::PI/180; $x1=256+[Math]::Cos($a)*145; $y1=256+[Math]::Sin($a)*145; $x2=256+[Math]::Cos($a)*205; $y2=256+[Math]::Sin($a)*205; $g.DrawLine($p,[float]$x1,[float]$y1,[float]$x2,[float]$y2)}; $p.Dispose() }
  }
  $g.Dispose(); Save-Asset $bmp ('icons\'+$Name)
}

function Make-TrafficLight([string]$Name,[string]$Active) {
  $bmp=New-Canvas 640 980; $g=Get-Gfx $bmp
  Draw-Round $g 85 45 470 890 120 ([System.Drawing.Color]::FromArgb(255,36,46,59)) ([System.Drawing.Color]::FromArgb(255,68,84,104)) 12
  $colors=@($C.Red,$C.Yellow,$C.Green); $keys=@('red','yellow','green'); $ys=@(125,365,605)
  for($i=0;$i -lt 3;$i++) {
    $on=($Active -eq $keys[$i]) -or ($Active -eq 'all')
    $outer=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255,19,26,35)); $g.FillEllipse($outer,155,$ys[$i],330,330); $outer.Dispose()
    $alpha=if($on){255}else{75}; $fill=[System.Drawing.Color]::FromArgb($alpha,$colors[$i])
    if($on){$glow=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(70,$colors[$i])); $g.FillEllipse($glow,120,$ys[$i]-35,400,400); $glow.Dispose()}
    $b=[System.Drawing.SolidBrush]::new($fill); $g.FillEllipse($b,182,$ys[$i]+27,276,276); $b.Dispose()
    $shineAlpha = if($on){125}else{30}
    $shine=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb($shineAlpha,255,255,255)); $g.FillEllipse($shine,225,$ys[$i]+65,105,70); $shine.Dispose()
  }
  $g.Dispose(); Save-Asset $bmp ('checker\'+$Name)
}

function Make-Label([string]$Name,[string]$Text,[System.Drawing.Color]$Accent) {
  $bmp=New-Canvas 1200 320; $g=Get-Gfx $bmp
  Draw-ShadowCard $g 35 25 1130 250 105 $C.White ([System.Drawing.Color]::FromArgb(255,214,230,243))
  $b=[System.Drawing.SolidBrush]::new($Accent); $g.FillEllipse($b,82,72,158,158); $b.Dispose()
  if($Name -match 'real'){Draw-Check $g 118 126 1.25 $C.White}elseif($Name -match 'suspicious'){Draw-Cross $g 127 116 1.15 $C.White}else{Draw-Text $g '?' ([System.Drawing.RectangleF]::new(80,61,162,162)) 112 $C.White ([System.Drawing.FontStyle]::Bold)}
  Draw-Text $g $Text ([System.Drawing.RectangleF]::new(270,53,820,190)) 72 $C.Navy ([System.Drawing.FontStyle]::Bold) 'Left'
  $g.Dispose(); Save-Asset $bmp ('checker\'+$Name)
}

function Make-Button([string]$Name,[System.Drawing.Color]$Top,[System.Drawing.Color]$Bottom,[string]$Text,[bool]$Enabled=$true) {
  $bmp=New-Canvas 1200 300; $g=Get-Gfx $bmp
  Draw-Round $g 45 44 1110 220 105 ([System.Drawing.Color]::FromArgb(30,14,40,66)) ([System.Drawing.Color]::Transparent) 0
  $p=Round-Path 35 25 1110 220 105; $grad=[System.Drawing.Drawing2D.LinearGradientBrush]::new([System.Drawing.RectangleF]::new(35,25,1110,220),$Top,$Bottom,90); $g.FillPath($grad,$p); $grad.Dispose(); $p.Dispose()
  $strokeAlpha=if($Enabled){90}else{35}; $textAlpha=if($Enabled){255}else{190}; $circleAlpha=if($Enabled){245}else{120}; $arrowColor=if($Enabled){$Bottom}else{$C.Gray}
  $stroke=[System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb($strokeAlpha,255,255,255),6); $p=Round-Path 35 25 1110 220 105; $g.DrawPath($stroke,$p); $stroke.Dispose(); $p.Dispose()
  Draw-Text $g $Text ([System.Drawing.RectangleF]::new(95,42,780,185)) 68 ([System.Drawing.Color]::FromArgb($textAlpha,255,255,255)) ([System.Drawing.FontStyle]::Bold)
  $b=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb($circleAlpha,255,255,255)); $g.FillEllipse($b,922,58,152,152); $b.Dispose(); Draw-Arrow $g 958 86 1.15 $arrowColor
  $g.Dispose(); Save-Asset $bmp ('ui\'+$Name)
}

function Make-BackButton {
  $bmp=New-Canvas 512 512; $g=Get-Gfx $bmp; Draw-ShadowCard $g 55 45 390 390 195 $C.White $C.BlueLight; Draw-Arrow $g 111 155 3.3 $C.Navy $true; $g.Dispose(); Save-Asset $bmp 'ui\ui_button_back_round.png'
}

function Make-RoundUtilityButton([string]$Name,[string]$Kind) {
  $bmp=New-Canvas 512 512; $g=Get-Gfx $bmp
  $b=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(35,16,42,74));$g.FillEllipse($b,64,76,390,390);$b.Dispose()
  $b=[System.Drawing.SolidBrush]::new($C.Navy);$g.FillEllipse($b,55,45,390,390);$b.Dispose()
  $p=[System.Drawing.Pen]::new($C.White,6);$g.DrawEllipse($p,55,45,390,390);$p.Dispose()
  if($Kind -eq 'sound') {
    $b=[System.Drawing.SolidBrush]::new($C.White);$g.FillPolygon($b,[System.Drawing.PointF[]]@([System.Drawing.PointF]::new(135,205),[System.Drawing.PointF]::new(205,205),[System.Drawing.PointF]::new(290,135),[System.Drawing.PointF]::new(290,345),[System.Drawing.PointF]::new(205,275),[System.Drawing.PointF]::new(135,275)));$b.Dispose();$p=[System.Drawing.Pen]::new($C.White,18);$g.DrawArc($p,262,170,115,140,-55,110);$p.Dispose()
  } else {
    $p=[System.Drawing.Pen]::new($C.White,24);$g.DrawEllipse($p,155,145,200,200);$g.DrawEllipse($p,222,212,66,66);for($i=0;$i -lt 8;$i++){$a=$i*45*[Math]::PI/180;$g.DrawLine($p,[float](255+[Math]::Cos($a)*110),[float](245+[Math]::Sin($a)*110),[float](255+[Math]::Cos($a)*155),[float](245+[Math]::Sin($a)*155))};$p.Dispose()
  }
  $g.Dispose(); Save-Asset $bmp ('ui\'+$Name)
}

function Make-Confetti {
  $bmp=New-Canvas 1400 700; $g=Get-Gfx $bmp; $colors=@($C.Green,$C.Blue,$C.Yellow,$C.Red,$C.Purple)
  $pieces=@(@(80,90,28,70,15),@(210,260,68,24,-20),@(350,65,32,76,28),@(515,315,30,75,-12),@(700,95,70,28,18),@(850,250,30,78,30),@(1010,70,68,26,-26),@(1200,285,30,72,8),@(1290,100,60,24,-15),@(110,500,58,24,25),@(390,535,26,70,-18),@(720,510,62,24,10),@(1040,520,28,72,22),@(1280,500,60,24,-30))
  for($i=0;$i -lt $pieces.Count;$i++){ $item=$pieces[$i]; $state=$g.Save(); $g.TranslateTransform($item[0]+$item[2]/2,$item[1]+$item[3]/2);$g.RotateTransform($item[4]);$b=[System.Drawing.SolidBrush]::new($colors[$i%$colors.Count]);$g.FillRectangle($b,-$item[2]/2,-$item[3]/2,$item[2],$item[3]);$b.Dispose();$g.Restore($state)}
  $g.Dispose();Save-Asset $bmp 'ui\confetti.png'
}

function Make-Card([string]$Name,[int]$W,[int]$H,[System.Drawing.Color]$Border,[int]$Radius=64) {
  $bmp=New-Canvas $W $H; $g=Get-Gfx $bmp; Draw-ShadowCard $g 34 24 ($W-80) ($H-80) $Radius ([System.Drawing.Color]::FromArgb(252,255,253,247)) $Border; $g.Dispose(); Save-Asset $bmp ('ui\'+$Name)
}

function Make-SpeechBubble([string]$Name='ui_speech_bubble.png',[string]$Text='') {
  $bmp=New-Canvas 1400 700; $g=Get-Gfx $bmp
  Draw-ShadowCard $g 45 35 1290 530 100 $C.White $C.Yellow
  $b=[System.Drawing.SolidBrush]::new($C.White); $g.FillPolygon($b,[System.Drawing.PointF[]]@([System.Drawing.PointF]::new(180,545),[System.Drawing.PointF]::new(330,545),[System.Drawing.PointF]::new(218,660))); $b.Dispose()
  $p=[System.Drawing.Pen]::new($C.Yellow,8); $g.DrawLines($p,[System.Drawing.PointF[]]@([System.Drawing.PointF]::new(180,545),[System.Drawing.PointF]::new(218,660),[System.Drawing.PointF]::new(330,545))); $p.Dispose()
  if($Text){Draw-Text $g $Text ([System.Drawing.RectangleF]::new(130,105,1120,340)) 64 $C.Navy ([System.Drawing.FontStyle]::Bold)}
  $g.Dispose(); Save-Asset $bmp ('ui\'+$Name)
}

function Make-Progress {
  $bmp=New-Canvas 1600 220; $g=Get-Gfx $bmp
  $pen=[System.Drawing.Pen]::new($C.LightGray,18); $pen.StartCap='Round'; $pen.EndCap='Round'; $g.DrawLine($pen,100,108,1500,108); $pen.Dispose()
  for($i=0;$i -lt 10;$i++){ $x=100+$i*(1400/9); $state=if($i -lt 4){'done'}elseif($i -eq 4){'current'}else{'empty'}; $color=if($state -eq 'done'){$C.Green}elseif($state -eq 'current'){$C.Blue}else{$C.White}; $stroke=if($state -eq 'empty'){$C.LightGray}else{$color}; $b=[System.Drawing.SolidBrush]::new($color); $g.FillEllipse($b,$x-40,68,80,80); $b.Dispose(); $p=[System.Drawing.Pen]::new($stroke,8); $g.DrawEllipse($p,$x-40,68,80,80); $p.Dispose(); if($state -eq 'done'){Draw-Check $g ($x-19) 93 .48 $C.White}elseif($state -eq 'current'){Draw-Text $g '5' ([System.Drawing.RectangleF]::new($x-38,69,76,76)) 42 $C.White ([System.Drawing.FontStyle]::Bold)}}
  $g.Dispose(); Save-Asset $bmp 'ui\ui_progress_10_step.png'
}

function Make-ProgressNode([string]$Name,[System.Drawing.Color]$Fill,[System.Drawing.Color]$Stroke,[string]$Glyph='') {
  $bmp=New-Canvas 256 256; $g=Get-Gfx $bmp; $b=[System.Drawing.SolidBrush]::new($Fill); $g.FillEllipse($b,32,32,192,192); $b.Dispose(); $p=[System.Drawing.Pen]::new($Stroke,14); $g.DrawEllipse($p,32,32,192,192); $p.Dispose(); if($Glyph -eq 'check'){Draw-Check $g 82 108 1.2 $C.White}elseif($Glyph){Draw-Text $g $Glyph ([System.Drawing.RectangleF]::new(38,35,180,180)) 92 $C.White ([System.Drawing.FontStyle]::Bold)}; $g.Dispose(); Save-Asset $bmp ('ui\'+$Name)
}

function Make-Connector([string]$Name,[System.Drawing.Color]$Color) { $bmp=New-Canvas 512 128; $g=Get-Gfx $bmp; $p=[System.Drawing.Pen]::new($Color,30); $p.StartCap='Round';$p.EndCap='Round';$g.DrawLine($p,35,64,477,64);$p.Dispose();$g.Dispose();Save-Asset $bmp ('ui\'+$Name) }

function Make-Message([string]$Name,[string]$Title,[string]$Body,[string]$Visual,[System.Drawing.Color]$Accent,[string]$Time='9:42 AM') {
  $bmp=New-Canvas 1400 760; $g=Get-Gfx $bmp
  Draw-ShadowCard $g 42 35 1310 650 72 ([System.Drawing.Color]::FromArgb(255,250,255,253)) ([System.Drawing.Color]::FromArgb(255,172,222,222))
  Draw-Text $g 'Forwarded' ([System.Drawing.RectangleF]::new(100,65,300,55)) 30 $C.Gray ([System.Drawing.FontStyle]::Italic) 'Left'
  # Shrink long titles so they stay on one line instead of wrapping into the "Forwarded" label.
  $titleSize = 54
  while ($titleSize -gt 34) {
    $probe = New-Font $titleSize ([System.Drawing.FontStyle]::Bold)
    $width = $g.MeasureString($Title, $probe).Width
    $probe.Dispose()
    if ($width -le 760) { break }
    $titleSize -= 2
  }
  Draw-Text $g $Title ([System.Drawing.RectangleF]::new(100,125,760,100)) $titleSize $C.Navy ([System.Drawing.FontStyle]::Bold) 'Left'
  Draw-Text $g $Body ([System.Drawing.RectangleF]::new(100,230,720,320)) 39 $C.Navy ([System.Drawing.FontStyle]::Regular) 'Left'
  Draw-Round $g 900 130 355 355 58 ([System.Drawing.Color]::FromArgb(255,235,245,248)) ([System.Drawing.Color]::FromArgb(255,198,220,233)) 5
  switch($Visual){
    'school' { $b=[System.Drawing.SolidBrush]::new($Accent); $g.FillRectangle($b,965,265,225,150); $g.FillPolygon($b,[System.Drawing.PointF[]]@([System.Drawing.PointF]::new(940,270),[System.Drawing.PointF]::new(1078,170),[System.Drawing.PointF]::new(1215,270)));$b.Dispose();$p=[System.Drawing.Pen]::new($C.Blue,8);for($i=0;$i -lt 6;$i++){$g.DrawLine($p,925+$i*55,155,890+$i*55,240)};$p.Dispose() }
    'gift' { Draw-Round $g 975 248 205 165 22 $Accent $C.Navy 7; $b=[System.Drawing.SolidBrush]::new($C.Yellow);$g.FillRectangle($b,1058,230,38,200);$g.FillRectangle($b,960,300,235,38);$b.Dispose(); }
    'herbal' { $b=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(180,103,176,98));$g.FillEllipse($b,1010,220,160,210);$b.Dispose();$p=[System.Drawing.Pen]::new($C.GreenDark,16);$g.DrawArc($p,1080,165,120,130,100,150);$p.Dispose(); }
    'calendar' { Draw-ClueIcon $g 'date' ([System.Drawing.RectangleF]::new(960,175,240,240)) }
    'flood' { Draw-ClueIcon $g 'image' ([System.Drawing.RectangleF]::new(960,175,240,240)); $p=[System.Drawing.Pen]::new($C.Blue,12);for($i=0;$i -lt 3;$i++){$g.DrawArc($p,930,350+$i*25,280,45,0,180)};$p.Dispose() }
    'notice' { Draw-ClueIcon $g 'source' ([System.Drawing.RectangleF]::new(960,175,240,240)) }
    'claim' { Draw-ClueIcon $g 'urgent' ([System.Drawing.RectangleF]::new(960,175,240,240)) }
    'weather' { $b=[System.Drawing.SolidBrush]::new($C.Blue);$g.FillEllipse($b,960,255,150,110);$g.FillEllipse($b,1050,215,170,150);$b.Dispose();$p=[System.Drawing.Pen]::new($C.Yellow,16);$g.DrawLine($p,1100,365,1060,440);$g.DrawLine($p,1160,365,1120,440);$p.Dispose() }
  }
  Draw-Text $g $Time ([System.Drawing.RectangleF]::new(1040,585,210,46)) 28 $C.Gray ([System.Drawing.FontStyle]::Regular) 'Right'
  $g.Dispose(); Save-Asset $bmp ('messages\'+$Name)
}

function Make-Result([string]$Name,[string]$Headline,[System.Drawing.Color]$Accent,[string]$State) {
  $bmp=New-Canvas 1600 1050; $g=Get-Gfx $bmp; Draw-ShadowCard $g 40 30 1500 930 80 $C.White ([System.Drawing.Color]::FromArgb(255,210,226,239))
  Draw-Round $g 80 70 1420 190 60 ([System.Drawing.Color]::FromArgb(35,$Accent)) $Accent 7
  Draw-Text $g $Headline ([System.Drawing.RectangleF]::new(280,90,1020,150)) 84 $Accent ([System.Drawing.FontStyle]::Bold)
  $b=[System.Drawing.SolidBrush]::new($Accent);$g.FillEllipse($b,120,100,130,130);$b.Dispose(); if($State -eq 'real'){Draw-Check $g 154 142 .95 $C.White}elseif($State -eq 'review'){Draw-Text $g '?' ([System.Drawing.RectangleF]::new(120,95,130,130)) 92 $C.White ([System.Drawing.FontStyle]::Bold)}else{Draw-Cross $g 155 132 .85 $C.White}
  $kinds=@('source','date','image','urgent');$labels=@('SOURCE','DATE','IMAGE','WORDS');for($i=0;$i -lt 4;$i++){ $x=92+$i*365; Draw-Round $g $x 340 320 460 48 ([System.Drawing.Color]::FromArgb(255,249,252,255)) $C.BlueLight 5; Draw-ClueIcon $g $kinds[$i] ([System.Drawing.RectangleF]::new($x+75,385,170,170)); Draw-Text $g $labels[$i] ([System.Drawing.RectangleF]::new($x+25,580,270,70)) 36 $C.Navy ([System.Drawing.FontStyle]::Bold); $status=if(($State -eq 'real') -or ($i -eq 1)){'CHECKED'}elseif($State -eq 'review'){'REVIEW'}else{'FLAG'}; $statusColor=if($status -eq 'CHECKED'){$C.Green}elseif($status -eq 'FLAG'){$C.Red}else{$C.Amber}; Draw-Text $g $status ([System.Drawing.RectangleF]::new($x+25,665,270,60)) 31 $statusColor ([System.Drawing.FontStyle]::Bold)}
  $g.Dispose(); Save-Asset $bmp ('results\'+$Name)
}

function Make-Badge([string]$Name,[string]$Label,[System.Drawing.Color]$Ring,[string]$Icon) {
  $bmp=New-Canvas 700 800; $g=Get-Gfx $bmp
  $b=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(35,20,44,77));$g.FillEllipse($b,113,88,494,494);$b.Dispose();$b=[System.Drawing.SolidBrush]::new($Ring);$g.FillEllipse($b,95,60,500,500);$b.Dispose();$b=[System.Drawing.SolidBrush]::new($C.Cream);$g.FillEllipse($b,155,120,380,380);$b.Dispose()
  if($Icon -eq 'check'){Draw-Check $g 245 250 2.5 $Ring}elseif($Icon -eq 'search'){ $p=[System.Drawing.Pen]::new($Ring,28);$g.DrawEllipse($p,230,190,190,190);$g.DrawLine($p,380,350,470,445);$p.Dispose()}else{ $p=[System.Drawing.Pen]::new($Ring,42);$p.StartCap='Round';$g.DrawLine($p,240,390,445,205);$p.Dispose() }
  $b=[System.Drawing.SolidBrush]::new($Ring);$g.FillPolygon($b,[System.Drawing.PointF[]]@([System.Drawing.PointF]::new(70,520),[System.Drawing.PointF]::new(630,520),[System.Drawing.PointF]::new(585,690),[System.Drawing.PointF]::new(350,650),[System.Drawing.PointF]::new(115,690)));$b.Dispose();Draw-Text $g $Label ([System.Drawing.RectangleF]::new(105,520,490,135)) 49 $C.White ([System.Drawing.FontStyle]::Bold)
  $g.Dispose();Save-Asset $bmp ('badges\'+$Name)
}

function Make-StarAsset([string]$Name,[string]$Mode) {
  $bmp=New-Canvas 512 512;$g=Get-Gfx $bmp;if($Mode -eq 'drag'){ $gl=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(75,$C.Yellow));$g.FillEllipse($gl,22,22,468,468);$gl.Dispose()};$fill=if($Mode -eq 'empty'){$C.White}else{$C.Yellow};$stroke=$C.Amber;$starRadius=if($Mode -eq 'drag'){210}else{185};Draw-Star $g 256 256 $starRadius $fill $stroke;$g.Dispose();Save-Asset $bmp ('weights\'+$Name)
}

function Make-WeightCard([string]$Name,[string]$Kind,[string]$Label) {
  $bmp=New-Canvas 900 1150;$g=Get-Gfx $bmp;Draw-ShadowCard $g 35 28 820 1040 70 $C.White $C.BlueLight;Draw-ClueIcon $g $Kind ([System.Drawing.RectangleF]::new(245,120,410,410));Draw-Text $g $Label ([System.Drawing.RectangleF]::new(100,560,700,110)) 58 $C.Navy ([System.Drawing.FontStyle]::Bold);for($i=0;$i -lt 3;$i++){ $starFill=if($i -lt 2){$C.Yellow}else{$C.White}; Draw-Star $g (260+$i*190) 800 75 $starFill $C.Amber};$g.Dispose();Save-Asset $bmp ('weights\'+$Name)
}

function Make-StyleCard([string]$Name,[string]$Title,[string]$Icon,[System.Drawing.Color]$Accent,[bool]$Selected=$false) {
  $bmp=New-Canvas 900 1180;$g=Get-Gfx $bmp;$border=if($Selected){$C.Yellow}else{$C.BlueLight};if($Selected){$gl=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(45,$C.Yellow));$g.FillEllipse($gl,20,10,860,1120);$gl.Dispose()};Draw-ShadowCard $g 45 35 810 1050 82 $C.White $border
  $b=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(45,$Accent));$g.FillEllipse($b,235,140,430,430);$b.Dispose()
  if($Icon -eq 'shield'){ $b=[System.Drawing.SolidBrush]::new($Accent);$g.FillPolygon($b,[System.Drawing.PointF[]]@([System.Drawing.PointF]::new(450,190),[System.Drawing.PointF]::new(590,245),[System.Drawing.PointF]::new(565,410),[System.Drawing.PointF]::new(450,520),[System.Drawing.PointF]::new(335,410),[System.Drawing.PointF]::new(310,245)));$b.Dispose();Draw-Check $g 390 330 1.5 $C.White }
  elseif($Icon -eq 'scale'){ $p=[System.Drawing.Pen]::new($Accent,24);$p.StartCap='Round';$g.DrawLine($p,450,205,450,500);$g.DrawLine($p,315,275,585,275);$g.DrawLine($p,365,275,315,400);$g.DrawLine($p,535,275,585,400);$g.DrawArc($p,250,350,130,100,0,180);$g.DrawArc($p,520,350,130,100,0,180);$p.Dispose() }
  else{ $b=[System.Drawing.SolidBrush]::new($Accent);$g.FillEllipse($b,330,250,240,200);$b.Dispose();Draw-Text $g '!' ([System.Drawing.RectangleF]::new(335,250,230,180)) 140 $C.White ([System.Drawing.FontStyle]::Bold) }
  Draw-Text $g $Title ([System.Drawing.RectangleF]::new(120,640,660,110)) 70 $C.Navy ([System.Drawing.FontStyle]::Bold);$desc=if($Title -eq 'CAREFUL'){'More items sent for review'}elseif($Title -eq 'BALANCED'){'Even mix of outcomes'}else{'More suspicious items flagged'};Draw-Text $g $desc ([System.Drawing.RectangleF]::new(130,770,640,150)) 39 $C.Gray; $g.Dispose();Save-Asset $bmp ('styles\'+$Name)
}

function Make-UtilityPanel([string]$Name,[string]$Title,[string]$Subtitle,[System.Drawing.Color]$Accent,[int]$W=1400,[int]$H=700) {
  $bmp=New-Canvas $W $H;$g=Get-Gfx $bmp;Draw-ShadowCard $g 35 28 ($W-80) ($H-90) 70 $C.White $Accent;Draw-Text $g $Title ([System.Drawing.RectangleF]::new(100,90,$W-200,130)) 66 $C.Navy ([System.Drawing.FontStyle]::Bold);Draw-Text $g $Subtitle ([System.Drawing.RectangleF]::new(120,235,$W-240,210)) 40 $C.Gray; $g.Dispose();Save-Asset $bmp ('ui\'+$Name)
}

# Core clue icons
Make-ClueIcon 'icon_source.png' 'source'
Make-ClueIcon 'icon_date.png' 'date'
Make-ClueIcon 'icon_image.png' 'image'
Make-ClueIcon 'icon_urgent_words.png' 'urgent'

# Supporting icons
Make-MiniIcon 'icon_check_green.png' 'check' $C.Green
Make-MiniIcon 'icon_cross_red.png' 'cross' $C.Red
Make-MiniIcon 'icon_question_gray.png' 'question' $C.Gray
Make-MiniIcon 'icon_warning_yellow.png' 'warning' $C.Yellow
Make-MiniIcon 'icon_forward_arrow.png' 'arrow' $C.Blue
Make-MiniIcon 'icon_share.png' 'share' $C.Blue
Make-MiniIcon 'icon_search.png' 'search' $C.Navy
Make-MiniIcon 'icon_repair_wrench.png' 'wrench' $C.Blue
Make-MiniIcon 'icon_magnifier.png' 'search' $C.Navy
Make-MiniIcon 'icon_star_gold.png' 'starFull' $C.Yellow
Make-MiniIcon 'icon_star_empty.png' 'starEmpty' $C.Gray
Make-MiniIcon 'icon_sound.png' 'sound' $C.Navy
Make-MiniIcon 'icon_settings.png' 'settings' $C.Navy
Make-MiniIcon 'icon_back.png' 'back' $C.Navy
Make-MiniIcon 'icon_next_arrow.png' 'arrow' $C.Navy

# Traffic checker and labels
Make-TrafficLight 'checker_traffic_light.png' 'all'
Make-TrafficLight 'checker_green_active.png' 'green'
Make-TrafficLight 'checker_yellow_active.png' 'yellow'
Make-TrafficLight 'checker_red_active.png' 'red'
Make-Label 'label_real.png' 'REAL' $C.Green
Make-Label 'label_suspicious.png' 'SUSPICIOUS' $C.Red
Make-Label 'label_needs_checking.png' 'NEEDS CHECKING' $C.Amber

# Buttons and cards
Make-Button 'ui_button_primary_green.png' ([System.Drawing.Color]::FromArgb(255,65,213,129)) $C.GreenDark 'NEXT'
Make-Button 'ui_button_primary_green_hover.png' ([System.Drawing.Color]::FromArgb(255,91,230,149)) $C.Green 'NEXT'
Make-Button 'ui_button_primary_green_pressed.png' $C.GreenDark ([System.Drawing.Color]::FromArgb(255,17,112,63)) 'NEXT'
Make-Button 'ui_button_primary_green_disabled.png' ([System.Drawing.Color]::FromArgb(255,190,202,198)) $C.Gray 'NEXT' $false
Make-Button 'ui_button_secondary_blue.png' ([System.Drawing.Color]::FromArgb(255,84,184,246)) ([System.Drawing.Color]::FromArgb(255,37,123,211)) 'CONTINUE'
Make-Button 'ui_button_build_checker.png' ([System.Drawing.Color]::FromArgb(255,65,213,129)) $C.GreenDark "LET'S BUILD A CHECKER!"
Make-Button 'ui_button_use_rule.png' ([System.Drawing.Color]::FromArgb(255,65,213,129)) $C.GreenDark 'USE THIS RULE'
Make-Button 'ui_button_check.png' ([System.Drawing.Color]::FromArgb(255,65,213,129)) $C.GreenDark 'CHECK'
Make-Button 'ui_button_fix_this.png' ([System.Drawing.Color]::FromArgb(255,65,213,129)) $C.GreenDark 'FIX THIS'
Make-Button 'ui_button_test_again.png' ([System.Drawing.Color]::FromArgb(255,65,213,129)) $C.GreenDark 'TEST AGAIN'
Make-Button 'ui_button_fix_mistakes.png' ([System.Drawing.Color]::FromArgb(255,65,213,129)) $C.GreenDark 'FIX THE MISTAKES'
Make-Button 'ui_button_finish.png' ([System.Drawing.Color]::FromArgb(255,65,213,129)) $C.GreenDark 'FINISH'
Make-BackButton
Make-RoundUtilityButton 'ui_button_sound_round.png' 'sound'
Make-RoundUtilityButton 'ui_button_settings_round.png' 'settings'
Make-Confetti
Make-Card 'ui_card_white_large.png' 1600 1100 $C.BlueLight 80
Make-Card 'ui_card_white_medium.png' 1200 820 $C.BlueLight 68
Make-Card 'ui_card_clue.png' 760 900 $C.BlueLight 70
Make-Card 'ui_card_message.png' 1500 900 ([System.Drawing.Color]::FromArgb(255,178,224,224)) 70
Make-Card 'ui_card_result.png' 1500 1050 $C.BlueLight 80
Make-SpeechBubble

# Progress pieces
Make-Progress
Make-ProgressNode 'progress_node_empty.png' $C.White $C.LightGray
Make-ProgressNode 'progress_node_done.png' $C.Green $C.Green 'check'
Make-ProgressNode 'progress_node_current_blue.png' $C.Blue $C.Blue '.'
Make-ProgressNode 'progress_node_current_yellow.png' $C.Yellow $C.Amber '.'
Make-ProgressNode 'progress_node_final_success.png' $C.Green $C.Green 'check'
Make-Connector 'progress_connector_done.png' $C.Green
Make-Connector 'progress_connector_empty.png' $C.LightGray

# Messages
Make-Message 'message_card_base.png' 'Message title' 'Reusable text area for a forwarded message. Replace this copy in the game.' 'notice' $C.Blue
Make-Message 'message_school_closure.png' 'School closed today' "Heavy rain is expected. Classes are closed today. Please check the school notice page for updates." 'school' $C.Red '6:40 AM'
Make-Message 'message_free_console.png' 'FREE GAME CONSOLE!' "You won! Tap this link in the next 5 minutes or your prize will be given away." 'gift' $C.Purple '4:12 PM'
Make-Message 'message_herbal_immunity.png' 'One drink prevents every illness' "Doctors do not want you to know this. Share now so everyone can try it!" 'herbal' $C.Green '7:05 PM'
Make-Message 'message_old_event_notice.png' 'Science fair this Friday' "Bring your project by 8:00 AM. Check the date - this notice was posted last year." 'calendar' $C.Amber '10:18 AM'
Make-Message 'message_reused_flood.png' 'Flooding in our town now' "This dramatic photo is being shared again. Does it really show today's weather?" 'flood' $C.Blue '2:26 PM'
Make-Message 'message_legitimate_school.png' 'Library hours updated' "The school library closes at 4:30 PM this week. See the official school page." 'notice' $C.Green '1:15 PM'
Make-Message 'message_fake_prize.png' 'You are our lucky winner' "Send your details now to claim a huge prize. Hurry - offer ends immediately!" 'gift' $C.Red '8:51 PM'
Make-Message 'message_calm_false_claim.png' 'A quiet claim to check' "This post sounds calm, but it gives no source or evidence for its surprising claim." 'claim' $C.Amber '11:30 AM'
Make-Message 'message_weather_alert.png' 'Weather alert' "Strong winds are expected after 6 PM. This alert links to the official forecast." 'weather' $C.Blue '3:45 PM'

# Results and badges
Make-Result 'result_suspicious_panel.png' 'SUSPICIOUS' $C.Red 'suspicious'
Make-Result 'result_real_panel.png' 'LIKELY REAL' $C.Green 'real'
Make-Result 'result_review_panel.png' 'NEEDS REVIEW' $C.Amber 'review'
Make-Badge 'badge_rule_tested.png' 'RULE TESTED' $C.Purple 'check'
Make-Badge 'badge_cause_found.png' 'CAUSE FOUND' $C.Blue 'search'
Make-Badge 'badge_fix_checked.png' 'FIX CHECKED' $C.Amber 'wrench'

# Star weights
Make-StarAsset 'star_full.png' 'full'
Make-StarAsset 'star_empty.png' 'empty'
Make-StarAsset 'star_dragging.png' 'drag'
Make-WeightCard 'weight_card_source.png' 'source' 'SOURCE'
Make-WeightCard 'weight_card_date.png' 'date' 'DATE'
Make-WeightCard 'weight_card_image.png' 'image' 'IMAGE'
Make-WeightCard 'weight_card_urgent.png' 'urgent' 'URGENT WORDS'

# Checker style cards and selected states
Make-StyleCard 'checker_style_careful.png' 'CAREFUL' 'shield' $C.Blue
Make-StyleCard 'checker_style_balanced.png' 'BALANCED' 'scale' $C.Green
Make-StyleCard 'checker_style_strict.png' 'STRICT' 'siren' $C.Red
Make-StyleCard 'checker_style_careful_selected.png' 'CAREFUL' 'shield' $C.Blue $true
Make-StyleCard 'checker_style_balanced_selected.png' 'BALANCED' 'scale' $C.Green $true
Make-StyleCard 'checker_style_strict_selected.png' 'STRICT' 'siren' $C.Red $true

# Screen-specific reusable pieces
Make-UtilityPanel 'ui_caption_panel.png' 'CHECK FOUR CLUES' 'Look at the source, date, image, and urgent words.' $C.Blue
Make-UtilityPanel 'ui_score_summary_card.png' 'BATCH COMPLETE!' 'Review your score and the two messages that need another look.' $C.Green
Make-UtilityPanel 'ui_actual_vs_app_panel.png' 'ACTUAL vs APP SAID' 'Compare the real answer with the checker result, then find the cause.' $C.Amber
Make-UtilityPanel 'ui_clue_status_box.png' 'CLUE STATUS' 'Checked / Missing / Suspicious' $C.Blue 900 520
Make-UtilityPanel 'ui_clue_answer_button.png' 'SOURCE' 'Tap to choose this clue.' $C.Blue 900 420
Make-SpeechBubble 'ui_instruction_bubble.png' 'Move one star to fix it.'
Make-UtilityPanel 'success_panel.png' 'CHECKER FIXED!' 'Every test message is now classified correctly.' $C.Green 1600 850
Make-UtilityPanel 'flagged_message_mini.png' 'FLAGGED MESSAGE' 'Tap to inspect the clue breakdown.' $C.Red 900 500
Make-UtilityPanel 'message_mini_green_check.png' 'MESSAGE CHECKED' 'All four clues agree.' $C.Green 900 500

# Importance rail and ranking tokens
$bmp = New-Canvas 1600 360
$g = Get-Gfx $bmp
Draw-Round $g 55 80 1490 190 90 ([System.Drawing.Color]::FromArgb(255,247,250,253)) $C.BlueLight 6
$grad = [System.Drawing.Drawing2D.LinearGradientBrush]::new([System.Drawing.RectangleF]::new(90,115,1420,120),$C.Green,$C.Red,0)
$g.FillRectangle($grad,90,115,1420,120)
$grad.Dispose()
Draw-Text $g 'MATTERS MORE' ([System.Drawing.RectangleF]::new(80,15,380,60)) 36 $C.GreenDark ([System.Drawing.FontStyle]::Bold)
Draw-Text $g 'MATTERS LESS' ([System.Drawing.RectangleF]::new(1140,15,380,60)) 36 $C.RedDark ([System.Drawing.FontStyle]::Bold)
$g.Dispose()
Save-Asset $bmp 'ui/ui_importance_rail.png'
for($i=1; $i -le 4; $i++) {
  $bmp = New-Canvas 256 256
  $g = Get-Gfx $bmp
  $b = [System.Drawing.SolidBrush]::new($C.Navy)
  $g.FillEllipse($b,25,25,206,206)
  $b.Dispose()
  Draw-Text $g ([string]$i) ([System.Drawing.RectangleF]::new(30,25,196,196)) 120 $C.White ([System.Drawing.FontStyle]::Bold)
  $g.Dispose()
  Save-Asset $bmp ("ui/ui_ranking_token_$i.png")
}

Write-Output "Generated deterministic UI asset library under $OutputRoot"
