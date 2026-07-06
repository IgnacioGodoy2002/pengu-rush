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

---

## Contrato canónico

### Flujo (parent-submit)

```
Juego bootea
→ registra listener postMessage
→ envía MINIGAME_READY
→ host recibe READY y envía SURA_MINIGAME_INIT
→ juego valida shape del payload → envía MINIGAME_SESSION_ACCEPTED
→ juego habilita JUGAR
→ usuario toca JUGAR → juego envía MINIGAME_STARTED → inicia GameScene
→ al terminar → juego envía MINIGAME_COMPLETED con score
→ host/SURA recibe COMPLETED y persiste el score (parent-submit)
→ juego NO llama al backend directamente
```

El juego nunca llama a endpoints HTTP para validar tokens ni registrar scores.
Toda la comunicación es por `postMessage`.

### Envelope de todos los mensajes

```ts
{
  source:  "sura-minigames",
  version: 1,
  type:    string,
  payload: Record<string, unknown>
}
```

### Mensajes host → juego

| Tipo | Cuándo |
|---|---|
| `SURA_MINIGAME_INIT` | Después de recibir `MINIGAME_READY` |
| `SURA_MINIGAME_PAUSE` | Host quiere pausar el juego |
| `SURA_MINIGAME_RESUME` | Host quiere reanudar el juego |

### Mensajes juego → host

| Tipo | Cuándo |
|---|---|
| `MINIGAME_READY` | JS cargado, bridge escuchando |
| `MINIGAME_SESSION_ACCEPTED` | Payload de INIT válido, contexto almacenado |
| `MINIGAME_STARTED` | Usuario tocó JUGAR |
| `MINIGAME_COMPLETED` | Partida terminada, score disponible |
| `MINIGAME_ERROR` | Payload de INIT inválido |
| `MINIGAME_EXIT_REQUESTED` | Usuario tocó "VOLVER A SURA" |

### Payload de `SURA_MINIGAME_INIT` (host → juego)

```ts
{
  token:      string;   // opaco — almacenado en memoria, nunca logueado
  session_id: string;
  player_id:  number;
  game_id:    string;
  nickname?:  string;
}
```

### Payload de `MINIGAME_COMPLETED` (juego → host)

```ts
{
  session_id: string;
  game_id:    string;
  score:      number;
  stats: {
    level?:            number;
    survivedMs?:       number;
    meteorsDestroyed?: number;
    isNewRecord?:      boolean;
  }
}
```

---

## Archivos principales

```text
src/integration/sura/SuraTypes.ts
src/integration/sura/SuraRuntimeConfig.ts
src/integration/sura/SuraBridge.ts
src/integration/sura/SuraApiClient.ts
src/integration/sura/MockSuraApiClient.ts
src/integration/sura/SuraIntegrationService.ts
```

- **`SuraTypes.ts`** — tipos compartidos y constantes de mensajes (`SURA_MSG`),
  contrato del envelope `{ source, version, type, payload }`.
- **`SuraRuntimeConfig.ts`** — detección de modo (`standalone` / `sura-mock` /
  `sura`) y config singleton `SURA_CONFIG`. Si `VITE_SURA_PARENT_ORIGIN` falta
  en modo `sura`, cae a standalone en lugar de romper la carga.
- **`SuraBridge.ts`** — capa de transporte `postMessage`: valida origin y source
  del mensaje entrante, mantiene un único listener.
- **`SuraApiClient.ts`** — interfaz `ISuraApiClient` y `RealSuraApiClient`.
  **No se usa en el flujo parent-submit actual.** Está como referencia para
  un posible flujo futuro con llamadas HTTP directas desde el juego.
- **`MockSuraApiClient.ts`** — simulación para desarrollo. No se incluye en el
  build de producción (eliminado por dead-code elimination del bundler).
- **`SuraIntegrationService.ts`** — orquestador singleton. Máquina de estados,
  ciclo de vida de la sesión, emisión de todos los mensajes postMessage.

---

## Configuración requerida

Crear un archivo `.env` en la raíz del repo (nunca versionarlo):

```env
VITE_SURA_INTEGRATION_MODE=sura
VITE_SURA_PARENT_ORIGIN=
VITE_SURA_API_BASE_URL=
VITE_SURA_GAME_ID=pengu_rush
VITE_SURA_GAME_VERSION=1.0.0
```

Ver `.env.example` en la raíz del repo para la plantilla completa.

Las variables `VITE_*` quedan embebidas en el build y son **públicas**.
Nunca deben contener:

- secretos;
- claves privadas;
- credenciales;
- tokens de usuarios.

`VITE_SURA_API_BASE_URL` no es necesaria para el flujo `parent-submit`,
pero puede dejarse vacía sin problema.

---

## Trabajo pendiente para SURA

- Confirmar `game_id` (`pengu_rush` es provisional).
- Proporcionar el origin permitido (`VITE_SURA_PARENT_ORIGIN`).
- Confirmar los nombres canónicos de todos los mensajes `postMessage`.
- Confirmar estructura del payload de `SURA_MINIGAME_INIT`.
- Confirmar campos requeridos del payload de `MINIGAME_COMPLETED`.
- Configurar staging y producción.
- Generar un build en modo `sura`.
- Probar el flujo completo READY → INIT → SESSION_ACCEPTED → STARTED → COMPLETED.

Si en el futuro se requiere que el juego llame al backend directamente:

- Proporcionar endpoints para validar, iniciar y completar sesión.
- Proporcionar headers, payloads y responses.
- Implementar `RealSuraApiClient` con las llamadas HTTP reales.
- Generar tokens dinámicos desde el backend.

---

## Build

```bash
npm install
npx tsc --noEmit
npm run build
```

- `dist/` es el build web final.
- El punto de entrada es `index.html`.
- `base: "./"` permite alojarlo en subcarpetas (no solo en la raíz del dominio).
- No es un ejecutable `.exe`.
- `index.html` carga el menú directamente en modo standalone.
- Nunca debe verse pantalla blanca. Si falta `VITE_SURA_PARENT_ORIGIN`, el juego
  cae a modo standalone automáticamente en lugar de fallar.

---

## Mock local

```bash
npm run dev
# abrir:
http://localhost:<puerto>/dev/sura-test-host.html
```

El host de prueba:

- Carga el juego en un iframe en modo `sura-mock`.
- Permite enviar `SURA_MINIGAME_INIT`, `PAUSE`, `RESUME` manualmente.
- Muestra todos los mensajes entrantes y salientes en el log.
- Es solo para desarrollo — no aparece en `dist`.
- No debe publicarse para usuarios finales.
