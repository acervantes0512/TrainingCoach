# Especificación: App de seguimiento corporal y nutricional con integración MCP a Claude

Este documento es el prompt/spec completo para pegar en una sesión aparte de Claude (o Claude Code) y que construya la aplicación. El objetivo final: una app web con dashboard visual + un servidor MCP remoto conectado a Claude.ai como "custom connector", de modo que en cualquier chat de Claude (como este) se puedan registrar datos diarios y consultar el progreso, y Claude siga dando coaching con contexto real e histórico.

---

## 1. Contexto y objetivo del usuario

Usuario: hombre, 178 cm de estatura, entrena fuerza 5 días/semana (lunes/jueves jale, martes/viernes empuje, miércoles pierna). Objetivo: bajar circunferencia de cintura conservando la mayor masa muscular posible (brazos) durante un déficit calórico.

- **Punto de partida:** 27 jul 2026 — cintura 100,5 cm, brazo derecho 43,1 cm, brazo izquierdo 42,0 cm, peso 85,4 kg.
- **Meta:** cintura ≤ 94 cm el 27 sep 2026 (8,9 semanas). Ritmo objetivo: ≈0,73 cm/semana.
- **Restricción:** perder máximo 1-2 cm de brazo en el proceso. El peso en báscula es secundario — la métrica que manda es la cintura.
- **Medición:** cintura, brazo derecho, brazo izquierdo, peso — en ese orden, en ayunas, en la mañana, después de entrenar, en las mismas condiciones. Se toma de lunes a viernes (sábado y domingo no se miden).
- **Metas nutricionales diarias:** proteína 150-170 g (piso duro 140 g — no negociable ni compensable entre días), calorías 2100-2300 kcal, carbohidratos 180-220 g, grasa 60-70 g.
- **Suplementación diaria:** proteína en polvo (VIPRO Classic, 1 scoop = 52 g = ~186 kcal / 40 g proteína / 1,4 g grasa / 2,4 g carbo) + creatina (Ultrapure, 5 g/día, todos los días incluidos fines de semana).

---

## 2. Qué debe hacer la app (dashboard visual)

### 2.1 Registro diario
- Formulario/rápido input para las 4 medidas corporales (cintura, brazo D, brazo I, peso) con fecha.
- Registro de comidas: tipo (desayuno/almuerzo/cena/snack/batido), descripción libre, macros (kcal, proteína, grasa, carbohidratos), y opcionalmente una foto (URL o archivo).
- Los macros de cada comida pueden venir ya calculados (el usuario se los da a Claude en el chat, Claude los calcula, y los envía a la app vía MCP) — la app no necesita IA propia de reconocimiento de imágenes, esa parte ya la hace Claude en la conversación.

### 2.2 Vista diaria
- Totales acumulados del día (kcal, proteína, grasa, carbohidratos) vs. metas, con barras de progreso (verde = dentro de rango, ámbar = cerca del límite, rojo = excedido). Replicar el estilo de barras que ya usamos en el chat: label, valor actual / rango meta, barra de color según estado.
- Lista de comidas registradas ese día con sus macros.

### 2.3 Vista semanal (lunes a viernes)
- Promedio semanal de cada medida corporal.
- Gráfica de línea: evolución de cintura semana a semana, con una segunda serie "ruta objetivo" (línea recta desde 100,5 cm el 27-jul hasta 94 cm el 27-sep) para comparar visualmente si el usuario va por encima o por debajo del ritmo necesario.
- Gráfica de línea o barras: evolución de brazo derecho e izquierdo (para vigilar que no bajen más de 1-2 cm).
- Cálculo automático de: ritmo actual (cm/semana), ritmo necesario restante, proyección de fecha de cumplimiento de meta con el ritmo actual.
- Semáforo de estado: "vas bien" / "hay que ajustar" / "vas atrasado".

### 2.4 Vista de tendencias nutricionales
- Promedio semanal de proteína, calorías, carbohidratos, grasa vs. metas.
- Alertas si el promedio de proteína cae bajo el piso de 140 g/día — este es el macro que NO se compensa entre días.

### 2.5 Reporte automático de viernes
- Resumen semanal generado (puede ser un botón "generar reporte" o corre automático) con: promedios, gráficas, delta vs. semana anterior, si el ritmo alcanza la meta del 27 de septiembre, y sugerencias.

---

## 3. Modelo de datos

```
measurements
- id
- date (date, único por día)
- waist_cm (float)
- arm_right_cm (float)
- arm_left_cm (float)
- weight_kg (float)
- created_at

meals
- id
- date (date)
- meal_type (enum: desayuno, almuerzo, cena, snack, batido)
- description (text)
- calories (float)
- protein_g (float)
- carbs_g (float)
- fat_g (float)
- photo_url (text, opcional)
- created_at

settings
- waist_goal_cm (float) = 94
- goal_date (date) = 2026-09-27
- baseline_waist_cm (float) = 100.5
- baseline_date (date) = 2026-07-27
- protein_min_g / protein_max_g = 150-170 (piso duro 140)
- calories_min / calories_max = 2100-2300
- carbs_min / carbs_max = 180-220
- fat_min / fat_max = 60-70
```

---

## 4. Servidor MCP remoto — herramientas a exponer

Este es el componente clave para que Claude (en cualquier chat) pueda leer y escribir datos. Debe ser un servidor MCP remoto (HTTP/SSE), desplegado en una URL pública HTTPS accesible desde internet (no localhost — Claude.ai se conecta desde la nube de Anthropic, no desde el navegador del usuario). Autenticación recomendada: header con API key fija (ya que es un solo usuario), o OAuth si se quiere más robustez.

Herramientas MCP sugeridas:

1. **log_measurement**(date, waist_cm, arm_right_cm, arm_left_cm, weight_kg) → guarda/actualiza la medida del día.
2. **log_meal**(date, meal_type, description, calories, protein_g, carbs_g, fat_g, photo_url?) → agrega una comida.
3. **update_meal** / **delete_meal**(meal_id, ...) → por si Claude necesita corregir un registro (como pasó en esta conversación con el almuerzo estimado que se corrigió después).
4. **get_day_summary**(date) → devuelve medidas del día + lista de comidas + totales de macros + comparación contra metas.
5. **get_week_summary**(week_start_date) → promedios lunes-viernes de medidas y macros, delta vs. semana anterior, ritmo cm/semana, proyección de fecha de meta.
6. **get_history**(metric, from_date, to_date) → serie de tiempo de una métrica (cintura, brazo_d, brazo_i, peso, proteína, etc.) para graficar.
7. **get_goal_progress**() → estado actual: cm restantes, semanas restantes, ritmo necesario, ritmo real promedio, si el plan sigue siendo alcanzable.
8. **update_settings**(...) → para ajustar metas si el usuario decide cambiarlas más adelante (ej. la fase de mantenimiento/volumen que se mencionó para después de llegar a la meta).

**Importante para las descripciones de las herramientas (tool descriptions):** deben dejar explícito en texto que:
- La proteína NO se compensa entre días (piso duro diario), pero calorías/grasa/carbohidratos sí se pueden compensar en promedio semanal.
- Las medidas solo se toman lunes-viernes; sábados y domingos no cuentan para el promedio semanal.
- El peso en báscula es dato secundario; la cintura es la métrica prioritaria.

---

## 5. Stack técnico sugerido

- **Backend + servidor MCP:** Node.js/TypeScript con el SDK oficial `@modelcontextprotocol/sdk`, expuesto sobre HTTP/SSE. Puede vivir en el mismo proyecto que la API REST del dashboard (mismo backend, dos entradas: rutas REST para el frontend, endpoint MCP para Claude).
- **Base de datos:** Postgres (Supabase/Neon/Railway tienen tier gratuito) o SQLite si se prefiere algo mínimo.
- **Frontend:** React (Next.js) con Recharts o Chart.js para las gráficas de línea (cintura vs. ruta objetivo) y barras (macros diarios).
- **Autenticación del MCP:** una sola API key en variable de entorno, enviada como header desde la configuración del custom connector en Claude.ai.
- **Despliegue:** Vercel (frontend + API routes) o Railway/Render (si se separa backend). Debe quedar con URL pública HTTPS.

---

## 6. Conexión con Claude una vez desplegada

1. Desplegar la app y anotar la URL pública del servidor MCP (ej. `https://tu-app.vercel.app/mcp`).
2. En Claude.ai: ir a **Configuración → Conectores → Añadir conector personalizado**, pegar la URL del servidor MCP, y si aplica, configurar el header de autenticación con la API key en "Configuración avanzada".
3. Una vez conectado, en cualquier chat (como este) se puede activar el conector y Claude podrá llamar directamente a `log_measurement`, `log_meal`, `get_week_summary`, etc., para guardar lo que el usuario reporte y consultar el histórico real antes de dar sugerencias — en vez de depender solo de la memoria de la conversación.

---

## 7. Prompt inicial para pegar en la nueva sesión (Claude Code u otra)

> Quiero construir una app web full-stack para seguimiento de medidas corporales y nutrición, con un servidor MCP remoto que Claude.ai pueda usar como custom connector. Te doy la especificación completa abajo — desarróllala como un proyecto Next.js + Postgres + un endpoint MCP usando el SDK oficial de Model Context Protocol, con autenticación por API key. Necesito: base de datos según el modelo que te doy, un dashboard con gráficas (cintura vs. ruta objetivo, barras de macros diarios con semáforo de color, promedios semanales lunes-viernes), y las herramientas MCP listadas para que Claude pueda leer y escribir datos directamente desde una conversación de chat. [Pegar aquí las secciones 1 a 6 de este documento]

---

## 8. Nota para Claude (esta conversación) una vez la app exista

Cuando el usuario confirme que la app está desplegada y el conector esté activo, este chat debe empezar a usar las herramientas MCP para persistir cada medida y cada comida en lugar de mantenerlas solo en el contexto de la conversación, y consultar `get_week_summary` / `get_history` antes de generar el informe de los viernes, para que el análisis se base en datos reales acumulados y no en lo que quede visible en el historial del chat.
