# Sube a S3 las fotos de perfil que ya existían en disco antes de activar PROFILE_IMAGES_MODE=s3.
# Las rutas guardadas en la BD (profile-images/user_X_Y.ext) coinciden con las claves en el bucket,
# así que no hay que tocar la base de datos.
#
# Requisitos: AWS CLI configurado (aws configure) con permiso s3:PutObject sobre el bucket.
#
# Uso:
#   .\upload-existing-profile-images.ps1 -Bucket gmo-profile-images-xxxx -UploadsDir "C:\ruta\a\uploads"
#
# UploadsDir es la carpeta "uploads" junto al backend: en desarrollo frontend/front/resources/backend/uploads,
# en una instalación <carpeta de GMO>/resources/backend/uploads.

param(
    [Parameter(Mandatory = $true)][string]$Bucket,
    [Parameter(Mandatory = $true)][string]$UploadsDir
)

$source = Join-Path $UploadsDir "profile-images"
if (-not (Test-Path $source)) {
    Write-Output "No existe ${source}: no hay fotos que migrar."
    exit 0
}

aws s3 cp $source "s3://$Bucket/profile-images" --recursive --exclude "*" `
    --include "*.png" --include "*.jpg" --include "*.jpeg" --include "*.webp" --include "*.gif"
