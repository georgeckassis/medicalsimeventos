# Simulador de cirugía robótica — Diseño (borrador)

Módulo nuevo dentro de este repositorio para que los **médicos residentes**
practiquen los movimientos de la consola de un robot quirúrgico (tipo da Vinci)
usando una **webcam y la pantalla de la PC**, como paso previo a la práctica en
un robot real. Más adelante se sumará un visor de VR.

Estado: **MVP implementado** (ver "Implementación"). Este documento se va
actualizando a medida que se cierran decisiones.

## Alcance

**Usuarios:** residentes. Por ahora siempre con un instructor presente; el
objetivo es que después puedan practicar a distancia.

**Etapa 1 (MVP):** que los ejercicios funcionen bien y la sensación de control
sea correcta. **Sin métricas todavía**, pero todo lo que pasa se registra como
eventos para poder calcularlas después.

**Fuera del MVP:** métricas y evaluación, sutura, tejido blando, energía,
tercer brazo, VR, modo remoto con instructor a distancia.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Dónde vive | Módulo dentro de `medicalsimeventos` |
| Captura | Webcam de la PC **apuntando a las manos desde arriba** (no a la cara), detección de manos en el navegador |
| Visualización | Pantalla de la PC (VR más adelante, sin rehacer la lógica) |
| Pedales | Teclado en el MVP; pedal propio fabricado más adelante (ver abajo) |
| Ejercicios MVP | Calibración, clutch y cámara, pick & place, ring walk |
| Procesamiento | Todo local en el navegador (tracking, física y render). El servidor solo guarda sesiones |
| Acceso | Por ahora solo super admin y encargado general (para probarlo). Después se habilita por nivel de usuario |
| Resultados | Al terminar cada ejercicio se muestra un resumen y queda guardado en el navegador. Las métricas formales y su guardado en la base vienen después |

## Modelo de la consola que se emula

| Consola real | Simulador (webcam) |
|---|---|
| Mover la mano con el controlador maestro → la punta del instrumento se traslada, con **escala** (ej. 3:1) | Posición = punto medio entre punta del pulgar y punta del índice. Escala configurable |
| Rotar la muñeca → la muñeca del instrumento (EndoWrist) copia la orientación | Orientación = plano de la palma (muñeca, base del índice, base del meñique) |
| Pinzar pulgar-índice → abre/cierra las mandíbulas | Distancia pulgar-índice normalizada por el tamaño de la mano → apertura 0..1 con histéresis |
| Filtro de temblor | Filtro de suavizado (One Euro) sobre posición y orientación |
| Pedal de clutch → desacopla mano e instrumento para reposicionar las manos | Tecla/pedal. Mientras está pisado, el instrumento queda quieto |
| Pedal de cámara + mover ambas manos → mueve el endoscopio | Tecla/pedal. Mientras está pisado, el movimiento de las manos mueve la cámara y los instrumentos quedan quietos |
| Alineación ojo-mano: el movimiento se interpreta en el marco de la cámara | Igual: mano a la derecha = instrumento a la derecha en pantalla, sin importar hacia dónde mire la cámara |
| Instrumento pivota en el trocar (centro remoto de movimiento) sin efecto fulcro para el cirujano | Igual: el vástago se dibuja pasando por el trocar; el control es directo |
| Cabeza fuera del visor → instrumentos bloqueados | Si se pierde una mano, su instrumento se congela (clutch automático) |
| Reenganche: alinear la pinza con el instrumento para retomar el control | Al volver la mano o soltar el clutch, se retoma de forma relativa (sin saltos) |

**Con la cámara cenital** (desde arriba), izquierda-derecha y
adelante-atrás salen directo de la imagen y son precisos. La altura de la
mano se estima por su tamaño aparente (más cerca de la cámara = más grande):
es el eje más ruidoso, y se compensa con más filtrado, el escalado y ayudas
visuales (sombras y una línea vertical de la punta al piso). Una segunda
cámara lo resuelve (ver "Próximos pasos").

## Arquitectura

```
app/simulador/                 páginas (selección de ejercicio, sesión)
lib/simulador/
  tracking/      Proveedor de manos (interfaz común)
                   webcam (MediaPipe Hands)   ← MVP
                   visor VR (WebXR)           ← futuro
  consola/       Mano → "controlador maestro": pose, pinza, clutch, cámara.
                 Fuente de pedales (teclado / pedal propio / gamepad)
  teleoperacion/ Escala, filtro, alineación ojo-mano, trocar
  escena/        Render 3D (Three.js) + física (Rapier)
  instrumentos/  Definiciones de instrumentos (pinza, porta-agujas, tijera…)
  ejercicios/    Motor de ejercicios: objetivos, reglas, estados
  eventos/       Bus de eventos (agarró, soltó, tocó, colisión, clutch…)
```

Cada capa habla con la siguiente por una interfaz. Para sumar VR se agrega un
proveedor de tracking y un modo de render; la consola, la teleoperación y los
ejercicios no cambian.

### Flujo por cuadro

```
cámara → tracking (21 puntos por mano)
       → consola (pose del maestro + pinza + pedales)
       → teleoperación (clutch, escala, filtro, marco de cámara)
       → escena (instrumentos, física, colisiones)
       → ejercicio (reglas, progreso)  → UI
                          └─ todo emite eventos al bus
```

### Objetivos de rendimiento

- Tracking ≥ 30 cuadros por segundo; render ≥ 60.
- Latencia de mano a pantalla < 100 ms.
- Debe andar en una notebook común con la webcam integrada.

### Tecnología propuesta

- Detección de manos: MediaPipe Hand Landmarker (`@mediapipe/tasks-vision`).
  El motor (WebAssembly) y el modelo se sirven desde la propia app.
- 3D: Three.js.
- Física: en el MVP no hace falta un motor; el agarre y las caídas se
  resuelven con reglas simples. Para sutura y tejido blando se evaluará
  Rapier u otro.
- Todo del lado del cliente; las páginas del simulador no se renderizan en el
  servidor.

## Ejercicios del MVP

Comunes a todos: estados *no iniciado → en curso ⇄ pausado → completado*,
reiniciar, instrucciones en pantalla, cronómetro visible (sin puntaje todavía)
y registro de eventos.

### 1. Calibración

Prepara el tracking para cada usuario y cada lugar.

1. Encuadre: ambas manos visibles, con buena luz. Se avisa si hay poca luz o
   si las manos salen del cuadro.
2. Posición neutra: el usuario deja las manos relajadas al frente, como en la
   consola. Esa posición es el centro del área de trabajo.
3. Pinza: abrir y cerrar pulgar-índice al máximo 3 veces, para medir el rango
   de cada mano.
4. Profundidad: acercar y alejar las manos para tomar la referencia de Z.

Termina cuando ambas manos se mantienen estables unos segundos. El perfil
queda guardado en el navegador para no repetirlo cada vez.

### 2. Clutch y cámara

Aprende a reposicionar las manos y a mover la vista.

- Esferas objetivo que hay que tocar con la punta del instrumento y sostener
  1 segundo.
- Primera parte: objetivos fuera del alcance de las manos sin usar el clutch.
- Segunda parte: objetivos fuera de la vista, que obligan a mover la cámara.
- Tercera parte: combinación de ambos.

### 3. Pick & place (peg transfer)

Agarre, coordinación bimanual y traslado.

- Tablero con postes y 6 piezas.
- Tomar cada pieza con la mano izquierda, pasarla en el aire a la derecha y
  dejarla en un poste del otro lado. Después, al revés.
- Una pieza que cae fuera del tablero se registra como caída y se reubica.

### 4. Ring walk

Precisión de la trayectoria y uso de la muñeca.

- Un aro enhebrado en un alambre curvo.
- Llevar el aro de punta a punta, con pases entre manos en puntos marcados.
- El contacto del aro con el alambre se marca en rojo y se registra.

## Pedales

**MVP:** teclas del teclado (Espacio = clutch, Shift = cámara).

**Después:** pedal fabricado por MedicalSim.

- Microcontrolador con USB nativo (Arduino Pro Micro / Leonardo o Raspberry Pi
  Pico) que se presenta como teclado o gamepad. No necesita drivers.
- Foot switches momentáneos entre un pin digital y GND (pull-up interno),
  con antirrebote en el firmware.
- Disposición imitando la consola (a validar con alguien que use el robot):
  clutch y cámara a la izquierda (más cambio de brazo), energía a la derecha.
- MVP del pedal: solo clutch y cámara.
- Modo teclado para prototipar (teclas F13–F15, que no chocan con nada); modo
  gamepad (Gamepad API) para la versión definitiva, porque no depende del foco
  de la ventana.
- Para probar ergonomía antes de fabricar: pedal USB triple programable
  comercial.

## Implementación (MVP)

Pantallas (menú lateral → **Simulador**):

- `/simulador`: calibración, ejercicios, configuración del puesto y últimos
  resultados.
- `/simulador/calibracion`: orientación de la cámara, posición neutra y rango
  de la pinza.
- `/simulador/<ejercicio>`: `clutch-camara`, `pick-place`, `ring-walk`.

Código:

| Archivo | Qué hace |
|---|---|
| `lib/simulador/tracking/` | `ProveedorManos` (interfaz) y `ProveedorWebcam` (MediaPipe) |
| `lib/simulador/consola/maestro.ts` | Mano → controlador maestro: posición (cm), orientación de la palma, apertura de la pinza; asigna izquierda/derecha por continuidad |
| `lib/simulador/consola/filtros.ts` | Filtro One Euro (cumple el rol del filtro de temblor) |
| `lib/simulador/consola/pedales.ts` | Clutch y cámara desde el teclado (o el pedal, que se presenta como teclado) |
| `lib/simulador/teleoperacion/` | Escala, clutch, cámara, alineación ojo-mano, límites, reenganche de la pinza |
| `lib/simulador/instrumentos/` | Pinza: vástago por el trocar, muñeca y mandíbulas |
| `lib/simulador/ejercicios/` | Interfaz `Ejercicio`, agarre y transferencias, los 3 ejercicios y el catálogo |
| `lib/simulador/eventos/bus.ts` | Registro de eventos de la sesión (base de las métricas) |
| `lib/simulador/simulacion.ts` | Ciclo de cada cuadro y resumen de resultados |

Teclas por defecto: **Espacio** = clutch, **Shift** = cámara, **Enter** =
comenzar/pausar. F13 y F14 quedan reservadas para el pedal.

Para sumar un ejercicio: implementar `Ejercicio` (`lib/simulador/ejercicios/tipos.ts`)
y agregarlo a `catalogo.ts`.

## Próximos pasos

### Dos cámaras

El navegador puede abrir dos webcams a la vez (cada una con su `deviceId`).
Conviene conectarlas a puertos USB de controladores distintos, o bajar la
resolución (640×480), porque dos cámaras HD pueden saturar un mismo puerto.

- **Arriba + costado (recomendado para empezar):** la cenital da
  izquierda-derecha y adelante-atrás; la lateral da la altura directo. No
  necesita calibración estéreo, solo saber dónde está cada una.
- **Estéreo (dos cámaras juntas):** triangulación 3D completa; requiere
  calibrarlas con un patrón (tablero de ajedrez o marcadores ArUco).

En el código entra como un nuevo `ProveedorManos` que combina las dos
detecciones; el resto no cambia.

### Soporte o "maestro" físico

Una réplica simple del controlador de la consola: un brazo articulado o
cardán donde se apoya la mano, con los dedos en anillos.

- Orientación: un sensor inercial (ej. BNO085) o encoders en cada eje.
- Pinza: un potenciómetro o sensor magnético (hall) entre los anillos.
- Posición: encoders en el brazo, o seguir usando la cámara solo para eso.
- Un microcontrolador lo envía por USB (WebHID / WebSerial desde el
  navegador).

Da sensación física real (apoyo, resistencia, rango limitado como en la
consola) y elimina el ruido de la cámara. En el código entra como otra fuente
de "controladores maestros" que reemplaza a cámara + `Consola`; la
teleoperación y los ejercicios no cambian.

### Otros

- Métricas formales (economía de movimiento, suavidad, errores) y guardado en
  la base, asociado al residente y al evento.
- Acceso por nivel de usuario (rol residente, vista del instructor).
- Sutura (porta-agujas y aguja), tejido blando, energía, tercer brazo.
- Visor de VR (WebXR): otro modo de render y, con hand tracking del visor,
  otro proveedor de manos.

## Preguntas abiertas

- PC y webcam con las que se va a usar (para ajustar los valores por defecto).
- Qué ve el instructor y cómo se asocian los resultados a cada residente.
