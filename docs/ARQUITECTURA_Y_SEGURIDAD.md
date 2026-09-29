# Arquitectura, seguridad y funcionalidades

## Resumen de la arquitectura

La aplicación sigue usando sus tres piezas originales:

- **React 19** renderiza toda la interfaz.
- **Electron 39** proporciona la aplicación de escritorio, ventanas, preload y empaquetado Windows.
- **Spring Boot 3.5** expone la API y persiste la información en MySQL mediante JPA.

Vite no sustituye React ni Electron. Solo sustituye a `react-scripts` como servidor de desarrollo y generador de los archivos estáticos que Electron carga.

## Migración de Create React App a Vite

Antes, `react-scripts@5` ocultaba Webpack, Babel, Jest, PostCSS y el servidor de desarrollo. El paquete está obsoleto y arrastraba numerosas alertas transitivas sin una actualización compatible.

Ahora:

- `npm start` ejecuta Vite en `127.0.0.1:3000`.
- `npm run build` genera la aplicación en `frontend/front/build`.
- Electron sigue cargando `http://localhost:3000` en desarrollo y `build/index.html` en producción.
- `base: "./"` conserva rutas relativas compatibles con `file://` y el instalador.
- El plugin `legacy-jsx-in-js` de `vite.config.js` permite mantener los archivos `.js` antiguos que contienen JSX. Los nuevos componentes deberían usar `.jsx`.
- La build separa React, gráficos, iconos y librerías generales para mejorar caché y tamaño de carga.

No había tests frontend ni variables `REACT_APP_*`; por eso no fue necesario migrar Jest ni variables de entorno. El script `npm test` valida actualmente una build completa.

## Comandos

Desde `frontend/front`:

```powershell
npm install
npm start
npm run build
npm audit
npm run i18n:audit
```

Desde `frontend`, los comandos `npm start`, `npm run build` y `npm test` delegan en `frontend/front`.

Desde `backend`:

```powershell
.\mvnw.cmd test
.\mvnw.cmd spring-boot:run
```

## Notas

Las notas no se guardan en `localStorage`. Se persisten en la tabla `notes` y cada fila referencia a su propietario mediante `owner_id`.

API autenticada:

- `GET /notes`: notas del usuario actual.
- `POST /notes`: crear una nota.
- `PUT /notes/{id}`: actualizar una nota propia.
- `DELETE /notes/{id}`: eliminar una nota propia.

El backend siempre filtra por el identificador del usuario autenticado. Conocer el ID de una nota ajena no permite leerla, modificarla o eliminarla. Se admiten título, contenido, color y estado fijado.

## Eventos recurrentes

Al crear un evento se puede elegir:

- Sin repetición.
- Diaria.
- Semanal.
- Días laborables.
- Días personalizados.

Toda serie requiere fecha final y está limitada a dos años y 731 ocurrencias. Esto evita peticiones accidentales o maliciosas que creen cantidades ilimitadas de registros.

Cada ocurrencia se materializa como un evento independiente y comparte `recurrenceSeriesId`. Esta decisión reutiliza sin excepciones la lógica existente de:

- Tags y colores.
- Asignaciones de administrador.
- Recordatorios.
- Consultas por rango.
- Tags `FOCUS` y `MANDATORY`.

Al borrar una fecha se elimina únicamente ese evento. Como la comprobación de apagado busca un evento `MANDATORY` activo concreto, esa fecha eliminada deja de activar el apagado sin afectar al resto de la serie.

## Dependencias y alertas

- Los dos proyectos npm quedan auditados con cero vulnerabilidades tras actualizar Electron y `electron-builder` y retirar `react-scripts`.
- Spring Boot se mantiene en la rama 3.x para evitar una migración mayor y se actualiza a la última versión pública de esa rama.
- JJWT, JNA y Gson se actualizan; WebJars y APIs de validación duplicadas sin uso se eliminan.
- Una alerta de Dependabot indica que una versión declarada está dentro de un rango vulnerable. No demuestra por sí misma que exista malware instalado. La gravedad práctica depende de si la dependencia se ejecuta, procesa entrada no confiable y forma parte de producción o solo del tooling.

La página privada de Dependabot requiere la sesión del propietario y no puede usarse como fuente pública reproducible. Las verificaciones locales se realizan contra los lockfiles exactos mediante `npm audit` y compilación Maven.

Electron mantiene `nodeIntegration: false` y `contextIsolation: true`. Además, el proceso principal rechaza nuevas ventanas solicitadas por el renderer y ya no declara la opción obsoleta `enableRemoteModule`.

## Reversión de Vite

Si alguna integración futura depende específicamente de Create React App, la reversión requiere volver a añadir `react-scripts`, restaurar sus scripts, recuperar `public/index.html` como plantilla y eliminar `vite.config.js` e `index.html` de la raíz. No se recomienda porque reintroduce la cadena de dependencias vulnerable y sin mantenimiento.
