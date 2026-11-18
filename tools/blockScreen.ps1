# Bloquea teclado y ratón durante el descanso y los libera siempre al terminar.
# La duración llega desde Electron (-Seconds); se acota para no dejar nunca la entrada bloqueada.
param(
    [int]$Seconds = 20
)

if ($Seconds -lt 1) { $Seconds = 1 }
if ($Seconds -gt 14400) { $Seconds = 14400 }

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class LockInput {
    [DllImport("user32.dll")]
    public static extern bool BlockInput(bool fBlockIt);
}
"@

try {
    [LockInput]::BlockInput($true) | Out-Null
    Start-Sleep -Seconds $Seconds
}
finally {
    [LockInput]::BlockInput($false) | Out-Null
}
