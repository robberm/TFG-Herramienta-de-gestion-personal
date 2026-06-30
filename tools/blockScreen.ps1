# Definir clase para bloquear teclado y ratón
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class LockInput {
    [DllImport("user32.dll")]
    public static extern bool BlockInput(bool fBlockIt);
}
"@

# Bloquear teclado y ratón
[LockInput]::BlockInput($true)

# Mantener bloqueo durante 20 segundos
Start-Sleep -Seconds 20

# Desbloquear teclado y ratón
[LockInput]::BlockInput($false)