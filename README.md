# Pengu Rush

Pengu Rush es un juego arcade espacial desarrollado con Phaser y TypeScript, en el que el jugador controla una nave piloteada por un pingüino, esquiva meteoritos, dispara, recoge escudos temporales y busca superar su récord.

**Versión actual: 1.0**

---

## Características principales

- Movimiento mediante teclado (escritorio) y controles táctiles (móvil)
- Disparo doble con cooldown
- Tres tamaños de meteoritos con resistencias distintas: 1, 3 y 7 impactos
- Dificultad progresiva: velocidad y frecuencia de meteoritos aumentan con el tiempo
- Distribución dinámica de meteoritos según el tiempo sobrevivido
- Puntuación por destruir y por esquivar meteoritos
- Récord persistente entre sesiones
- Escudo temporal que absorbe un único impacto
- Efectos visuales de impacto y explosión
- Sacudidas de cámara al recibir daño
- Música de fondo y efectos de sonido
- Mute global (música y efectos simultáneamente)
- Pausa durante la partida
- Tutorial integrado en la primera partida
- Pantalla de instrucciones adaptada a móvil y escritorio
- Estadísticas en la pantalla de Game Over
- Soporte multitouch real: mover y disparar con dos dedos simultáneamente

---

## Controles

### Escritorio

| Acción | Control |
|---|---|
| Mover la nave | `A` / `D` o flechas `←` / `→` |
| Disparar | `ESPACIO` |
| Pausar | `P` / `ESC` o botón PAUSA |
| Silenciar | Botón de audio |

### Móvil

| Acción | Control |
|---|---|
| Mover la nave | Deslizar el dedo |
| Disparar | Botón FIRE |
| Mover y disparar | Dos dedos simultáneos |
| Pausar | Botón PAUSA |
| Silenciar | Botón de audio |

---

## Meteoritos

| Tipo | Resistencia |
|---|---:|
| Pequeño | 1 impacto |
| Mediano | 3 impactos |
| Grande | 7 impactos |

---

## Escudo

El escudo aparece de manera ocasional durante la partida. Al recogerlo, protege la nave de un único impacto. Una vez que absorbe el choque, desaparece. Si no se usa, expira solo después de un tiempo. No puede acumularse más de uno.

---

## Tecnologías

| Tecnología | Versión |
|---|---|
| [Phaser](https://phaser.io/) | ^4.2.0 |
| [TypeScript](https://www.typescriptlang.org/) | ~6.0.2 |
| [Vite](https://vite.dev/) | ^8.1.0 |
| HTML5 / CSS | — |

> Node.js es necesario como entorno de desarrollo para ejecutar los scripts de npm.

---

## Instalación y ejecución

```bash
git clone https://github.com/IgnacioGodoy2002/pengu-rush.git
cd pengu-rush
npm install
npm run dev
```

Vite mostrará en la terminal la dirección local para abrir en el navegador.

---

## Probar desde un celular en la red local

```bash
npm run dev -- --host 0.0.0.0
```

- El dispositivo y la PC deben estar en la misma red Wi-Fi.
- Abrir en el celular la dirección **Network** que muestra Vite en la terminal.
- No usar `localhost` desde el celular.

---

## Build de producción

```bash
npm run build
```

El resultado se genera en la carpeta `dist/`. Para probar el build localmente:

```bash
npm run preview -- --host 0.0.0.0
```

---

## Estructura del proyecto

```
src/
├── config/           # Configuraciones de meteoritos, escudo, arma, cámara y propulsores
├── constants/        # Tema visual, paleta y parámetros de dificultad
├── effects/          # Efecto visual del propulsor (ThrusterEffect)
├── scenes/           # Escenas del juego y fondo espacial
├── services/         # Servicios de audio y récords
├── ui/               # Componentes de interfaz reutilizables
└── main.ts           # Punto de entrada y configuración de Phaser

public/
├── assets/
│   ├── obstacles/    # Sprites de meteoritos
│   └── player/       # Sprites de la nave
├── audio/
│   ├── sfx/          # Efectos de sonido (OGG)
│   ├── juego.ogg     # Música de partida
│   └── menu.ogg      # Música del menú
└── backgrounds/      # Imagen de fondo del espacio
```

---

## Escenas principales

| Escena | Descripción |
|---|---|
| `BootScene` | Precarga todos los assets (audio e imágenes) e inicializa el gestor de música |
| `MenuScene` | Pantalla de inicio con título, récord y botones de acción |
| `InstructionsScene` | Pantalla de instrucciones adaptada a móvil y escritorio |
| `GameScene` | Lógica principal: movimiento, disparos, meteoritos, escudo y HUD |
| `GameOverScene` | Muestra estadísticas, detecta nuevo récord y permite reiniciar o volver al menú |

---

## Servicios y configuraciones

- **MusicManager** — gestiona la música de fondo con soporte para mute y desbloqueo de audio en iOS
- **SoundEffectsManager** — reproduce efectos de sonido con throttle y verificación de caché
- **RecordsService** — guarda y recupera récords del jugador mediante `localStorage`
- **SpaceBackground** — genera el fondo espacial animado con parallax de estrellas
- **ThrusterEffect** — partículas visuales del propulsor de la nave
- `config/` — valores centralizados para meteoritos, escudo, arma, cámara y propulsores

---

## Persistencia

El navegador conserva entre sesiones:

- Récord de puntuación
- Estado del mute (música y efectos)
- Si el tutorial de primera partida ya fue visto

No se requiere cuenta ni backend.

---

## Estado del proyecto

Pengu Rush 1.0 es una versión jugable y completa, compatible con escritorio y dispositivos táctiles modernos.

---

## Posibles mejoras futuras

Las siguientes ideas no están implementadas en la versión 1.0:

- Nuevos power-ups o variantes de escudo
- Jefes de nivel
- Skins de nave
- Sistema de logros
- Ranking online
- Niveles temáticos o eventos especiales
