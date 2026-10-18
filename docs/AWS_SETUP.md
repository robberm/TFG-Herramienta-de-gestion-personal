# GMO en AWS: base de datos centralizada (RDS) y fotos de perfil (S3)

Esta guía explica cómo pasar GMO de "MySQL en Docker en cada PC" a una base de datos
compartida en **AWS RDS**, con las fotos de perfil en **S3**. El backend sigue
ejecutándose en el PC de cada usuario (lo arranca Electron); solo cambia dónde viven los datos.

```
PC del usuario                                   AWS
┌──────────────────────────────┐                ┌──────────────────────────────┐
│ Electron ── Backend (Java) ──┼── MySQL/SSL ──▶│ RDS MySQL db.t4g.micro       │
│   gmo.env       │            │                └──────────────────────────────┘
│                 └────────────┼── HTTPS ──────▶ Lambda (firma URLs) ──▶ S3 (fotos)
└──────────────────────────────┘
```

## 0. Coste estimado y alertas (hazlo primero)

| Concepto | Aprox. al mes |
|---|---|
| RDS MySQL `db.t4g.micro`, Single-AZ | ~$12–14 (Europa) |
| 20 GB gp3 | ~$2,5 |
| IPv4 pública de RDS | ~$3,6 |
| Backups (hasta el tamaño de la BD) | $0 |
| S3 + Lambda (fotos) | ~$0 |
| **Total** | **~$18–20** |

1. *Billing and Cost Management → Budgets → Create budget → Cost budget*.
2. Presupuesto mensual de $25 con alertas al **20 %, 60 % y 100 %** (≈ $5, $15, $25) a tu email.
3. En *Billing → Credits* comprueba saldo y fecha de caducidad de tus créditos.

> Mientras desarrollas puedes **detener la instancia RDS** (*Actions → Stop temporarily*):
> solo pagas almacenamiento. AWS la vuelve a arrancar sola a los 7 días.

Usa siempre la misma región para todo (p. ej. `eu-south-2` España o `eu-west-3` París).

## 1. Crear la base de datos (RDS)

### 1.1 Grupo de parámetros con SSL obligatorio
*RDS → Parameter groups → Create*: familia `mysql8.4`, nombre `gmo-mysql84`.
Edita el parámetro `require_secure_transport` = `1`. Así RDS rechaza conexiones sin cifrar.

### 1.2 Instancia
*RDS → Create database → Standard create*:

| Campo | Valor |
|---|---|
| Engine | MySQL 8.4 |
| Template | **Free tier** si aparece; si no, *Dev/Test* |
| Availability | **Single-AZ** (Multi-AZ duplica el precio) |
| DB instance identifier | `gmodb` |
| Master username | `admin` — guarda la contraseña en un gestor de contraseñas |
| Instance class | `db.t4g.micro` |
| Storage | gp3, 20 GB, **desactiva storage autoscaling** |
| Public access | **Yes** (cada PC se conecta directamente; ver §6) |
| VPC security group | nuevo: `gmo-db-sg` |
| Initial database name (Additional configuration) | `gmoapp_db` |
| DB parameter group | `gmo-mysql84` |
| Backup retention | 7 días |
| Performance Insights / Enhanced monitoring | **Desactivados** (tienen coste) |
| Deletion protection | Activado |

### 1.3 Security group
*EC2 → Security groups → gmo-db-sg → Inbound rules*: `MySQL/Aurora (3306)` desde `0.0.0.0/0`.

No se puede limitar a las IPs de casa de cada usuario (cambian). Mientras solo lo uses tú,
puedes poner tu IP (*My IP*) y abrirlo al publicar el instalador.

### 1.4 Usuarios de la base de datos
Conéctate con el usuario `admin` (MySQL Workbench, DBeaver o `mysql` CLI usando el *Endpoint*
de la consola) y crea el usuario que irá en los instaladores, **sin permisos de esquema**:

```sql
CREATE USER 'gmo_app'@'%' IDENTIFIED BY '<contraseña-larga-y-aleatoria>' REQUIRE SSL;
GRANT SELECT, INSERT, UPDATE, DELETE ON gmoapp_db.* TO 'gmo_app'@'%';
```

- `admin` → solo tú, para aplicar migraciones.
- `gmo_app` → el que va en `gmo.env` de los usuarios. Si alguien lo extrae, puede leer y
  modificar datos, pero no borrar tablas ni cambiar el esquema.

## 2. Crear el esquema (Flyway)

El esquema lo gestiona Flyway (`backend/src/main/resources/db/migration`). Las migraciones
se aplican **solo desde tu máquina con el usuario `admin`**:

1. En el `.env` de la raíz del repo (copia de `.env.example`):
   ```
   DB_URL=jdbc:mysql://<endpoint-rds>:3306/gmoapp_db?sslMode=REQUIRED
   DB_USERNAME=admin
   DB_PASSWORD=<contraseña admin>
   DB_MIGRATE=true
   JWT_SECRET=<cualquier cadena de 32+ caracteres>
   ```
2. `cd backend && ./mvnw spring-boot:run` — en el log verás
   `Successfully applied 2 migrations ... now at version v2`. Ya puedes pararlo.

### ¿Quieres llevarte los datos de tu MySQL local?
Antes del paso 2, vuelca la BD de Docker (en local se llama `tfgapp_db`) y cárgala en `gmoapp_db` de RDS:
```powershell
docker exec db_app mysqldump -u<usuario> -p<contraseña> --single-transaction --no-tablespaces tfgapp_db > gmo-local.sql
mysql -h <endpoint-rds> -u admin -p --ssl-mode=REQUIRED gmoapp_db < gmo-local.sql
```
Al arrancar el backend con `admin`, Flyway detecta que el esquema ya existe, lo adopta como
versión 1 y aplica solo la V2 (que arregla la columna de las notas).

### Cambios de esquema a partir de ahora
Cada cambio en una entidad JPA necesita **un nuevo fichero** `V<n>__descripcion.sql`.
Hibernate ya no toca el esquema (`ddl-auto=validate`): si falta la migración, el backend
no arranca y dice qué columna o tabla no cuadra.

## 3. Configurar los PCs (gmo.env)

Copia `frontend/front/resources/config/gmo.env.example` como `gmo.env`:

```
DB_URL=jdbc:mysql://<endpoint-rds>:3306/gmoapp_db?sslMode=REQUIRED
DB_USERNAME=gmo_app
DB_PASSWORD=<contraseña de gmo_app>
DB_MIGRATE=false
# Cambia a s3 tras el paso 4 (los comentarios van siempre en su propia línea)
PROFILE_IMAGES_MODE=local
```

- **Para el instalador**: deja `gmo.env` en `frontend/front/resources/config/`; `npm run dist`
  lo empaqueta. Está en `.gitignore`, nunca se sube al repo.
- **En un PC concreto**: `%APPDATA%/GMO/gmo.env` tiene prioridad sobre el empaquetado.

Con `DB_URL` remota, Electron **no arranca Docker** (ahorra 1–2 GB de RAM). El secreto JWT
lo genera Electron por instalación en `%APPDATA%/GMO/jwt.secret`; no hay que configurarlo.

## 4. Fotos de perfil en S3

### 4.1 Bucket
*S3 → Create bucket*: nombre único (p. ej. `gmo-profile-images-<algo>`), misma región,
**Block all public access: activado**, cifrado SSE-S3 (por defecto). Nada más.

### 4.2 Lambda que firma URLs
1. Empaqueta el código:
   ```powershell
   cd infra/aws/profile-image-signer
   npm install --omit=dev
   Compress-Archive -Path index.mjs, package.json, node_modules -DestinationPath signer.zip -Force
   ```
2. *Lambda → Create function*: `gmo-profile-image-signer`, runtime **Node.js 22.x**,
   arquitectura arm64. Sube `signer.zip` (*Upload from → .zip*). Handler: `index.handler`.
3. *Configuration → Environment variables*:
   - `BUCKET_NAME` = nombre del bucket
   - `SIGNER_KEY` = una clave aleatoria larga, p. ej.:
     `-join ((1..48) | % { '{0:x}' -f (Get-Random -Max 16) })` en PowerShell
4. *Configuration → Permissions → rol de ejecución → Add permissions → Create inline policy* (JSON):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
       "Resource": "arn:aws:s3:::<bucket>/profile-images/*"
     }]
   }
   ```
5. *Configuration → Function URL → Create*: Auth type **NONE** (la protege `SIGNER_KEY`).
6. *Configuration → Concurrency → Reserved concurrency* = `5`: limita el coste si alguien abusa.

La Lambda solo firma claves `profile-images/user_<id>_<ts>.<ext>`, imágenes de hasta 5 MB,
con URLs que caducan en 5 min (subida) y 15 min (descarga).

### 4.3 Activar el modo S3
En `gmo.env`:
```
PROFILE_IMAGES_MODE=s3
PROFILE_IMAGES_SIGNER_URL=<Function URL>
PROFILE_IMAGES_SIGNER_KEY=<SIGNER_KEY>
```

### 4.4 Subir las fotos que ya existían
```powershell
.\infra\aws\scripts\upload-existing-profile-images.ps1 -Bucket <bucket> -UploadsDir "<ruta>\resources\backend\uploads"
```
(requiere AWS CLI con `aws configure`). Las rutas guardadas en la BD no cambian.

### 4.5 Comprobar
1. Arranca GMO, cambia tu foto de perfil y comprueba en S3 que aparece en `profile-images/`.
2. Recarga la app: la foto debe verse (el backend redirige a una URL firmada).
3. Si falla, mira *Lambda → Monitor → CloudWatch logs* y `%APPDATA%/GMO/startup.log`.

## 5. Opcional: verificar el certificado de RDS

`sslMode=REQUIRED` cifra la conexión pero no comprueba que el servidor sea RDS. Para
verificarlo, descarga el bundle de certificados de RDS
(`https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem`), conviértelo en un
truststore PKCS12 siguiendo la guía de AWS *"Using SSL/TLS to encrypt a connection to a DB
instance"* (sección Java), empaquétalo con la app y usa:
```
DB_URL=jdbc:mysql://<endpoint>:3306/gmoapp_db?sslMode=VERIFY_CA&trustCertificateKeyStoreUrl=file:///<ruta>/rds-truststore.p12&trustCertificateKeyStoreType=PKCS12&trustCertificateKeyStorePassword=<pass>
```

## 6. Limitaciones de seguridad conocidas

Con el backend en cada PC, **las credenciales de `gmo_app` viajan en cada instalación** y
RDS es accesible desde internet. Mitigaciones aplicadas: SSL obligatorio, usuario sin
permisos de esquema, contraseñas largas, fotos privadas tras URLs firmadas y de corta vida.

Aun así, alguien que extraiga `gmo.env` podría leer o modificar datos de otros usuarios
(el filtrado por usuario lo hace el backend, no la BD). Es aceptable para uso personal o
un piloto; antes de abrirlo a usuarios desconocidos, la API debería moverse a la nube
(o usar un servicio con seguridad por fila, como Supabase) y los PCs dejar de conectarse
directamente a la BD.
