# Integración SURA — Entrega para el equipo de SURA

## Estado actual

- Pengu Rush funciona en modo standalone (sin integración) por defecto.
- La integración mock fue probada dentro de un iframe.
- `postMessage`, inicio, pausa, reanudación y finalización simulados funcionan.
- La arquitectura para la integración real está preparada, pero la conexión
  real todavía no está implementada. `RealSuraApiClient` no realiza llamadas
  HTTP hasta que SURA proporcione los endpoints, payloads y respuestas
  oficiales.
- La validación real de tokens y el registro real del score todavía no están
  conectados.

## Archivos principales

```text
src/integration/sura/SuraTypes.ts
src/integration/sura/SuraRuntimeConfig.ts
src/integration/sura/SuraBridge.ts
src/integration/sura/SuraApiClient.ts
src/integration/sura/MockSuraApiClient.ts
src/integration/sura/SuraIntegrationService.ts
```

- **`SuraTypes.ts`** — tipos compartidos y contrato del envelope `postMessage`
  (`{ source: "sura-minigames", version: 1, type, payload }`).
- **`SuraRuntimeConfig.ts`** — detección de modo (`standalone` / `sura-mock` /
  `sura`) y config singleton `SURA_CONFIG`. Valida que `parentOrigin` y
  `apiBaseUrl` estén presentes antes de permitir el modo `sura`.
- **`SuraBridge.ts`** — capa de transporte `postMessage`: valida origin y
  source del mensaje entrante, mantiene un único listener.
- **`SuraApiClient.ts`** — interfaz `ISuraApiClient` y `RealSuraApiClient`.
  El cliente real todavía está sin endpoints: cada método existe pero no
  realiza ninguna llamada HTTP hasta que SURA defina la API.
- **`MockSuraApiClient.ts`** — simulación exclusiva para desarrollo. No se
  incluye en el build de producción (eliminado por dead-code elimination
  del bundler).
- **`SuraIntegrationService.ts`** — máquina de estados y coordinación:
  orquestador singleton (`initSuraService` / `getSuraService`) que maneja
  el ciclo de vida de la sesión y los eventos de pausa/reanudación hacia
  el host.

## Configuración requerida

```env
VITE_SURA_INTEGRATION_MODE=sura
VITE_SURA_PARENT_ORIGIN=
VITE_SURA_API_BASE_URL=
VITE_SURA_GAME_ID=pengu_rush
VITE_SURA_GAME_VERSION=1.0.0
```

Estos valores son provisionales y deben completarse con datos reales
provistos por SURA. Ver `.env.example` en la raíz del repo para la
plantilla versionada (sin valores reales).

Las variables `VITE_*` quedan embebidas en el build y son **públicas**.
Nunca deben contener:

- secretos;
- claves privadas;
- credenciales;
- tokens de usuarios.

## Trabajo pendiente para SURA

- Confirmar `game_id`.
- Proporcionar el origin permitido (`VITE_SURA_PARENT_ORIGIN`).
- Proporcionar la URL base de la API (`VITE_SURA_API_BASE_URL`).
- Definir endpoints para validar, iniciar y completar sesión.
- Definir headers, payloads y responses.
- Confirmar los eventos oficiales de `postMessage`.
- Implementar `RealSuraApiClient` con las llamadas HTTP reales.
- Generar tokens dinámicos desde el backend.
- Configurar staging y producción.
- Generar un build en modo `sura`.
- Probar el registro real del score.

## Build

```text
npm install
npx tsc --noEmit
npm run build
```

- `dist/` es el build web final.
- El punto de entrada es `index.html`.
- `base: "./"` permite alojarlo en subcarpetas (no solo en la raíz del
  dominio).
- No es un ejecutable `.exe`.

## Mock local

```text
npm run dev
http://localhost:<puerto>/dev/sura-test-host.html
```

- Es solo para desarrollo.
- No aparece en `dist`.
- No debe publicarse para usuarios finales.
