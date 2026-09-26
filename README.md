# MedicalSim Eventos

App para gestionar el **calendario de cursos de capacitación** y su
**logística**: qué objetos se llevan a cada evento, el checklist de carga y
descarga (con firma y foto), los horarios, el chofer y el vehículo, los alumnos
inscriptos por QR, las tareas del equipo y las **alertas de incumplimiento**
por mail (WhatsApp queda preparado).

Mismo stack y estilo que el panel interno (`medicalsimapp`), pero es un
proyecto separado, con su propia base de datos.

## Roles

| Rol | Qué hace |
|---|---|
| **Super admin** | Acceso total, solo para MedicalSim. No aparece en ningún listado. Se crea solo al arrancar (`SUPERADMIN_EMAIL`). |
| **Encargado general** | Único que crea, edita o borra eventos, fechas y horarios de armado/desarmado; arma la lista de objetos desde el inventario; asigna el representante de ventas de cada institución y, en cada evento, el instructor y el representante de ventas a cargo; carga inventario, instituciones y usuarios; crea y asigna tareas; reabre etapas firmadas. |
| **Encargado de logística** | Ve el calendario; carga y edita el inventario del depósito (no lo borra); carga horarios de carga en depósito, salida, retiro y devolución, más el chofer y el vehículo; tilda los objetos cargados y cierra cada etapa con firma y foto. |
| **Chofer** | Ve el calendario y el checklist; tilda objetos y firma carga, descarga y devolución al depósito. |
| **Instructor** (MedicalSim) | Ve los eventos donde está asignado como instructor a cargo. Solo mira. Recibe los avisos de incumplimiento de sus eventos. |
| **Representante de ventas** (MedicalSim) | Vendedor que atiende una o más instituciones. Ve los eventos que tiene a cargo y los de las instituciones que atiende. Solo mira. Recibe los avisos de incumplimiento de sus eventos. |
| **Representante de la institución** | Del cliente (ej. el jefe médico del hospital). Ve los eventos de su institución sin poder tocar nada, y firma una validación de que revisó el evento. |

Nadie más que el encargado general (o el super admin) puede borrar cosas.
Los usuarios no se borran: se desactivan, para no perder quién tildó o firmó.

Las contraseñas se guardan cifradas (hash): nadie, ni el super admin, puede
verlas después de guardarlas. Al crear o resetear un usuario se puede ver lo
que se escribe o generar una al azar y copiarla para pasársela a la persona.

## Cómo funciona un evento

1. **Encargado general** crea el evento (curso, fechas, institución, sede,
   alumnos, horarios de armado y desarmado) y arma la lista de objetos
   eligiendo del **Inventario** con un desplegable + cantidad. Si en esas
   fechas otro evento usa el mismo objeto y no alcanza el stock, avisa.
2. **Logística** carga los horarios de carga, salida, retiro y devolución, el
   chofer y el vehículo (patente, para pedir el ingreso a la sede).
3. El **checklist** tiene 4 etapas: carga en depósito → descarga en la sede
   → carga para el retiro → devolución al depósito. Logística o el chofer
   tildan cada objeto (se puede poner cantidad parcial) y cierran la etapa con
   **firma + foto**. Cerrada la etapa, ya no se puede destildar; solo el
   encargado general la reabre, y el motivo queda en el historial.
4. Todo lo que pasa queda en el **Historial** del evento (quién, qué y cuándo).
5. Los alumnos se inscriben escaneando el **QR** del evento (formulario
   público: nombre, apellido, DNI, mail, teléfono, institución, especialidad).

## Alertas

El motor (`lib/alertas/motor.ts`) compara lo que debería estar hecho a cada
hora contra lo tildado:

- **Aviso previo** (por defecto 60 min antes, configurable): falta tildar algo
  de una etapa, o vence una tarea. Va a logística y al chofer (o al
  responsable de la tarea).
- **Incumplimiento**: llegó la hora de una etapa y no está tildada y cerrada
  con firma; o se cerró una etapa con faltantes (ej. volvieron 2 de 3 TV); o
  venció una tarea. Va a **todos los encargados generales + el encargado de
  logística del evento** (o a todos los de logística si no hay uno asignado)
  + el instructor y el representante de ventas a cargo del evento,
  más los mails extra de Configuración y los del propio evento.
- **Logística incompleta**: a menos de 48 h del evento falta horario de carga,
  salida, chofer o vehículo.

Las alertas se ven en la app (campana roja arriba, banner en el evento, página
de Alertas) y se mandan por mail. Se resuelven solas cuando se cumple lo
pendiente; el encargado general puede darlas por atendidas.

**¿Cuándo se revisan?** Todo corre dentro de la propia app:

- Cada **5 minutos** con un reloj interno (`instrumentation.ts`) cuando la app
  corre como servidor permanente (`npm start` en un VPS, Railway, Render…).
  Así el mail sale aunque nadie tenga la app abierta.
- Cada vez que alguien usa la app, y enseguida después de cada tilde, cierre
  o cambio de horario.
- En **Vercel** las funciones se apagan entre pedidos, así que el reloj
  interno no corre. Para que los avisos salgan aunque nadie esté usando la
  app, hace falta un llamado periódico a `GET /api/cron/alertas` (con el
  header `Authorization: Bearer $CRON_SECRET`). El plan Pro de Vercel lo
  hace con un `vercel.json`:

  ```json
  { "crons": [{ "path": "/api/cron/alertas", "schedule": "*/5 * * * *" }] }
  ```

  (El plan Hobby solo permite crons diarios, por eso no viene incluido.)

## Diagnóstico

La pantalla **Diagnóstico** (encargado general y super admin) muestra los
errores del servidor y del navegador, los rechazos (datos inválidos, sin
permiso) y cada intento de guardar un evento, con usuario y navegador, de los
últimos 30 días. El botón **Probar guardado** hace una prueba completa contra
la base (crea un evento de prueba y lo deshace) y dice en qué paso falla.

Si un navegador es demasiado viejo para la app, a los 10 segundos aparece un
aviso rojo abajo explicando que no terminó de cargar.

## Stack

- Next.js 16 (App Router, TypeScript), API y pantallas en el mismo proyecto.
- Postgres con `postgres` (postgres.js). Las tablas se crean solas al arrancar
  (`lib/db/client.ts`). Fotos y firmas se guardan en la misma base.
- `zod` para validar todo lo que entra a la API.
- Login con mail + contraseña (hash scrypt), sesión en cookie firmada que se
  renueva con el uso (8 h de inactividad).
- Mails por Gmail SMTP (`nodemailer`), WhatsApp Cloud API preparado.

## Estructura

```
app/api/            # API: eventos, items, logistica, checklist, etapas, validaciones,
                    # alumnos, qr, historial, inventario, vehiculos, instituciones,
                    # usuarios, tareas, alertas, cron, inscripcion (pública), login
app/                # Pantallas: calendario, eventos/[id], inventario, tareas, alertas…
components/         # UI compartida (AppShell, Crud, FirmaCanvas, CapturaFoto) y
components/evento/  # pestañas de la pantalla del evento
lib/db/             # Acceso a datos por entidad
lib/alertas/        # Motor de alertas
lib/notificaciones/ # Mail y WhatsApp
lib/auth/           # Contraseñas, sesión, permisos por rol
proxy.ts            # Exige sesión en todo salvo login, inscripción por QR y cron
```

## Correr localmente

```bash
npm install
cp .env.example .env.local   # completar DATABASE_URL como mínimo
npm run dev
```

Entrar en http://localhost:3000 con `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD`
(si no se define la contraseña, la inicial es `admin`). La app muestra un
aviso hasta que se cambie desde **Mi cuenta** — cambiala antes de mostrarla a
nadie. Después crear desde **Usuarios** al encargado general y al resto del
equipo.

Variables de entorno: ver `.env.example`.
