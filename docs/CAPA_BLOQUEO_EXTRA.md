# Capa de bloqueo extra: documentación técnica

> Estado: documento vivo. Describe únicamente la integración confirmada en el
> código. Los cambios que se incorporen a la capa extra se añadirán a la sección
> «Cambios integrados», no como un diario de intentos.

## Propósito, en sencillo

El modo de enfoque puede forzar un descanso. Durante ese descanso la aplicación
no solo muestra una pantalla de bloqueo: añade una medida nativa de Windows que
inhabilita temporalmente teclado y ratón. La primera capa disuade e informa al
usuario; la segunda evita que la pantalla pueda esquivarse interactuando con
otras ventanas mientras dura el descanso.

La ampliación más reciente añade una tercera capa, específica del navegador:
una extensión local para Chrome y Edge redirige los dominios que el usuario haya
configurado mientras Focus esté activo. Así, el bloqueo de aplicaciones Windows
y el bloqueo de navegación se configuran desde la misma pantalla, pero se
ejecutan en sus plataformas respectivas.

No es un control de seguridad del sistema operativo ni pretende sustituir el
inicio de sesión de Windows. Es una restricción temporal de bienestar/productividad
que se ejecuta en el equipo local.

## Flujo de extremo a extremo

```text
Configuración o evento Focus activo
          |
          v
BlockingService (backend, cada segundo)
          |
          | /topic/block: { type: "BLOCK_SCREEN", durationSeconds, endsAtEpochMs }
          v
FocusModeListener (renderer React)
          |
          | IPC: start-block(payload)
          v
Electron main process
          |----------------------------|
          v                            v
Ventana fullscreen siempre encima   tools/blockScreen.ps1 (Windows)
                                     BlockInput(true) durante el descanso
```

La interfaz React no ejecuta comandos del sistema: `preload.js` expone una API
estrecha (`window.electronAPI.startBlock`) y el proceso principal de Electron
es quien recibe el mensaje IPC. Esto conserva el aislamiento de contexto y evita
dar acceso Node.js al renderer.

## Componentes y responsabilidad

| Componente | Responsabilidad |
| --- | --- |
| `backend/.../BlockingService.java` | Mantiene el ciclo trabajo/descanso, calcula las fechas de inicio y fin, y publica los eventos de bloqueo. |
| `frontend/front/src/components/layout/FocusModeListener.jsx` | Se suscribe al WebSocket y traduce el evento de backend a una petición IPC local. |
| `frontend/front/electron/preload.js` | Publica el método mínimo `startBlock` mediante `contextBridge`. |
| `frontend/front/electron/electron.js` | Crea y cierra la ventana de bloqueo; en Windows lanza el script nativo. |
| `tools/blockScreen.ps1` | Llama a `user32.dll!BlockInput` para bloquear teclado y ratón y los desbloquea al acabar. |
| `backend/.../AppRestrictionService.java` | Complementa el descanso cerrando periódicamente los ejecutables configurados cuando el modo Focus está activo; es independiente del bloqueo de entrada. |
| `frontend/browser-extension/background.js` | Consulta la política local de Focus y traduce los dominios en reglas dinámicas de bloqueo/redirección del navegador. |
| `frontend/browser-extension/blocked.html` | Página local que se muestra al navegar a un dominio restringido. |
| `frontend/browser-extension/manifest.json` | Declara una extensión Manifest V3 para Chrome/Edge, sus permisos y su service worker. |

## Detalle de funcionamiento

`BlockingService` considera activo el modo Focus si el usuario lo habilitó en
configuración o si existe un evento de calendario de categoría `FOCUS` en curso.
Cuando termina el intervalo de trabajo, marca el descanso como activo y, si la
acción configurada es `SCREEN_BLOCK`, publica `BLOCK_SCREEN`. El mensaje lleva
la duración y la fecha absoluta de finalización para que los clientes puedan
sincronizarse con el servidor.

El listener React solo se conecta en rutas privadas con sesión. Al recibir ese
mensaje invoca la API que Electron inyecta en la ventana. Electron crea una
`BrowserWindow` a pantalla completa, sin marco, fuera de la barra de tareas y
con prioridad `screen-saver`; se cierra tras `durationSeconds`.

En Windows, Electron también intenta ejecutar `tools/blockScreen.ps1`. El script
declara la función Win32 `BlockInput`, activa el bloqueo, espera y lo desactiva.
El script es intencionadamente de alcance local: no modifica políticas del
sistema, registro ni credenciales.

## Contratos que no conviene romper

- El payload de `/topic/block` debe conservar `type: "BLOCK_SCREEN"` y una
  `durationSeconds` positiva. El listener mantiene compatibilidad con el antiguo
  payload de texto plano, pero las nuevas implementaciones deben usar JSON.
- El canal IPC se llama `start-block`; `preload.js` es la frontera de seguridad.
  No se debe exponer `ipcRenderer` completo al renderer.
- La ventana y la capa nativa deben usar la misma duración efectiva. Si se añade
  una duración configurable al script, debe recibirse desde Electron, no quedar
  fijada a una constante distinta.
- `BlockInput(false)` debe ejecutarse siempre después de haber activado
  `BlockInput(true)`, también ante errores o cierre anticipado. Dejar la entrada
  bloqueada sería un fallo crítico de experiencia y recuperación.
- El mecanismo debe permanecer condicionado a `process.platform === "win32"`.
  En otros sistemas la aplicación conserva la ventana visual, sin invocar
  utilidades de Windows.

## Límites y consideraciones operativas

- `BlockInput` solo puede bloquear la entrada de la sesión de escritorio donde
  se ejecuta; no equivale a bloquear Windows ni es una garantía frente a un
  usuario con privilegios administrativos.
- La ejecución de PowerShell puede estar restringida por políticas corporativas
  o antivirus. Si falla, la ventana visual sigue siendo la degradación segura;
  el fallo debe registrarse sin impedir el cierre normal de la ventana.
- El proceso que llama a `BlockInput` debe poder completar su temporizador. Por
  ello, cualquier rediseño debe prever liberación garantizada (por ejemplo,
  `try`/`finally` en PowerShell) y no depender solo de que Electron siga vivo.
- La restricción de procesos (`AppRestrictionService`) se revisa cada cinco
  segundos y mata únicamente ejecutables validados/configurados. No debe
  mezclarse con el bloqueo de teclado/ratón: son dos salvaguardas con ciclos y
  riesgos distintos.

## Puntos de integración pendientes de validar

Estas observaciones reflejan el estado actual del árbol de trabajo; no son
cambios aprobados ni se deben considerar resueltos hasta que el código final los
cubra y se prueben.

- `electron.js` carga `frontend/front/public/block.html`, pero ese archivo no
  existe actualmente. La capa visual no estará completa hasta añadir el recurso
  o ajustar la ruta a su ubicación definitiva.
- `createBlockWindow` usa la duración recibida para cerrar la ventana, mientras
  que `tools/blockScreen.ps1` espera 20 segundos fijos. Para duraciones distintas
  habría desacople: la ventana podría cerrarse antes o después de liberar la
  entrada. La solución final debe transportar una única duración validada al
  script o usar otra estrategia que comparta el mismo fin de bloqueo.

## Bloqueo de sitios web en Chrome y Edge

### Qué aporta

La pestaña **Webs** de la pantalla de Bloqueo permite gestionar una lista de
dominios, por ejemplo `instagram.com` o `youtube.com`. La lista se persiste en
la configuración local de GMO y una extensión de navegador la convierte en
reglas efectivas solo mientras el modo Focus efectivo esté activo. «Efectivo»
incluye tanto el interruptor manual como un evento de calendario de categoría
`FOCUS` actualmente activo.

La extensión es local y se instala manualmente como extensión sin empaquetar:
no se publica ni depende de una cuenta de Chrome/Edge. Sus instrucciones de
instalación están en `frontend/browser-extension/README.md`.

### Flujo de datos

```text
Pestaña Webs (React)
       | CRUD de dominios
       v
/api/blocked-websites  ──► Config.blockedWebsites (persistencia local)

Extensión Chrome/Edge ── GET periódico ──► /api/browser-blocking-policy
       |                                  (Focus efectivo + dominios)
       v
Reglas dinámicas declarativeNetRequest
       |
       v
Dominio o subdominio configurado ──► blocked.html de la extensión
```

### Backend: modelo y API

`IStorageService.Config` incorpora `blockedWebsites` (`Set<String>`). Al leer
configuraciones antiguas, `StorageServiceImpl` inicializa el campo vacío si no
existía; con ello se mantiene la compatibilidad de los ficheros ya creados.

`AppRestrictionService` centraliza el CRUD y normaliza cada entrada antes de
guardarla:

- elimina `http://` o `https://`, `www.` y cualquier ruta posterior;
- convierte a minúsculas;
- acepta únicamente dominios con formato válido;
- evita duplicados y devuelve error si se intenta borrar un dominio ausente.

`AppController` expone los siguientes contratos:

| Endpoint | Uso | Resultado |
| --- | --- | --- |
| `GET /api/blocked-websites` | Cargar lista en la aplicación. | Conjunto de dominios. |
| `POST /api/blocked-websites` | Añadir `{ "domain": "ejemplo.com" }`. | `204 No Content`; validación/duplicado producen error. |
| `DELETE /api/blocked-websites/{domain}` | Eliminar una entrada. | `204 No Content`. |
| `GET /api/browser-blocking-policy` | Política de solo lectura para la extensión. | `{ focusModeEnabled, blockedDomains }`. |

El endpoint de política no entrega configuración privada ni credenciales: solo
el booleano efectivo de Focus y los dominios que la extensión necesita para
aplicar la restricción local. CORS se amplía para permitir orígenes
`chrome-extension://*`, manteniendo también `http://localhost:3000` para el
frontend de desarrollo.

### Extensión: ejecución y comportamiento ante fallos

La extensión sigue Manifest V3 y usa `declarativeNetRequest`, no scripts
inyectados en las páginas. Por cada dominio válido genera una regla de
redirección con el filtro `||dominio^`, que abarca el dominio y sus subdominios,
para navegaciones principales y subframes. El destino es `blocked.html`, un
recurso propio de la extensión.

Las reglas de red no cubren todas las navegaciones: una PWA con service worker
(caso de `x.com`) puede servir la página sin que la petición `main_frame` llegue
a evaluarse, los cambios de ruta de una SPA no generan petición, y una pestaña
ya abierta al activar Focus no vuelve a navegar. Por eso existe una segunda capa
basada en pestañas: `webNavigation.onCommitted` y `onHistoryStateUpdated` (solo
marco principal) comprueban el host de la URL y, si coincide con un dominio
activo o un subdominio suyo, redirigen la pestaña a `blocked.html`. Al aplicar
una política nueva se revisan también todas las pestañas abiertas. La
coincidencia es por host exacto o sufijo `.dominio`, de modo que `box.com` no se
confunde con `x.com`.

La política se actualiza al instalar la extensión, al iniciar el navegador,
cuando GMO publica un cambio en `/topic/focus-state` y cada 30 segundos mediante
`chrome.alarms`. Si GMO/localhost no responde, conserva
las últimas reglas instaladas. Este comportamiento evita una apertura temporal
de la navegación restringida durante un reinicio, pero también significa que el
navegador no libera las reglas hasta que pueda volver a leer una política que
indique Focus desactivado. El último conjunto aplicado queda guardado en
`chrome.storage.local` para diagnóstico.

### Límites del diseño web

- El bloqueo solo alcanza navegadores donde la extensión haya sido instalada y
  habilitada; no bloquea otros navegadores, aplicaciones de escritorio ni
  conexiones de red a nivel de sistema.
- El usuario puede desactivar o desinstalar una extensión local. Es una barrera
  de productividad, no una medida de control administrativo.
- El manifiesto solicita acceso a todas las URLs para poder comparar cualquier
  navegación con la lista local. Cualquier revisión de privacidad debe mantener
  el permiso mínimo compatible con ese comportamiento.
- La actualización puede tardar hasta un minuto después de cambiar Focus o la
  lista, salvo en los eventos de instalación/inicio. Si se requiere respuesta
  inmediata, habrá que introducir una notificación desde la aplicación o reducir
  el intervalo con el coste correspondiente.

## Verificación recomendada

1. Configurar una pausa corta y seleccionar `SCREEN_BLOCK`.
2. Confirmar que backend publica el evento y que el renderer llama una sola vez
   a `startBlock`.
3. En Windows, comprobar que aparece la ventana fullscreen y que teclado y ratón
   recuperan siempre el control al finalizar la duración.
4. Probar la cancelación del descanso y el cierre de la aplicación durante el
   bloqueo; nunca debe quedar la entrada retenida.
5. En una plataforma no Windows, confirmar que no se invoca PowerShell y que la
   aplicación mantiene el bloqueo visual.
6. Con una aplicación incluida en la lista de restringidas, comprobar que el
   mecanismo de procesos sigue funcionando y no interfiere con la liberación de
   entrada.

## Cambios integrados

### Base documentada (30 de septiembre de 2026)

- Orquestación de descanso en `BlockingService` mediante WebSocket.
- Puente React → preload → IPC → proceso principal de Electron.
- Ventana de bloqueo visual de Electron y script de Windows basado en
  `BlockInput` como capa adicional.
- Restricción independiente de ejecutables configurables durante el modo Focus.

### Bloqueo web local (3 de octubre de 2026)

- Se añade `blockedWebsites` a la configuración persistida, con inicialización
  compatible para configuraciones existentes.
- La aplicación permite listar, añadir y eliminar dominios desde una pestaña
  propia de la pantalla Bloqueo; el backend valida y normaliza esas entradas.
- Se publica una política mínima de navegador con Focus efectivo y dominios, y
  se habilita CORS para extensiones de Chrome.
- Se incorpora `frontend/browser-extension`, una extensión Manifest V3 para
  Chrome/Edge que actualiza reglas dinámicas y redirige dominios restringidos a
  una página local de Focus.

### Bloqueo de x.com y navegaciones fuera de la red (4 de octubre de 2026)

- **Problema:** con Focus activo y `x.com` presente en la política
  (`GET /api/browser-blocking-policy` lo devolvía correctamente), el sitio seguía
  cargando. La regla `||x.com^` era válida; el fallo estaba en que las
  navegaciones servidas por el service worker de la PWA, las rutas SPA y las
  pestañas ya abiertas no pasan necesariamente por `declarativeNetRequest`.
- **Archivos:** `frontend/browser-extension/background.js`,
  `frontend/browser-extension/manifest.json` (permiso `webNavigation`, versión
  0.1.2).
- **Comportamiento final:** se mantiene la capa de reglas de red y se añade la
  comprobación por pestaña descrita en «Extensión: ejecución y comportamiento
  ante fallos». Los dominios activos se recuperan de `chrome.storage.local`
  cuando el service worker MV3 se reactiva.
- **Compatibilidad:** sin cambios en backend ni en la API. En modo desarrollador
  basta con pulsar «Recargar» en la tarjeta de la extensión.
- **Prueba realizada:** comprobación aislada de la función de coincidencia
  (`x.com`, `www.x.com` y `mobile.x.com` bloquean; `box.com` y
  `youtube.com.evil.io` no) y verificación manual en el navegador con la
  extensión recargada: `x.com` queda redirigido a `blocked.html` con Focus
  activo.

Los cambios posteriores se registrarán aquí con: archivos afectados, comportamiento
final, compatibilidad y prueba realizada.
