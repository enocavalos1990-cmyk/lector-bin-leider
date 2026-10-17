# Prueba de sincronización (NO desplegada)

## Archivos experimentales
- `mobile-sync.html`: prototipo móvil QR con inicio/fin de pesajes y captura en D1.
- `pc.html`: panel PC para elegir, iniciar y finalizar pesajes, introducir bruto por fila con Enter.
- `src/sync-api.js`: API con token de dispositivo y aislamiento por espacio de trabajo.
- `migrations/0001_shared_weighings.sql`: tablas D1.
- `tests/`: pruebas unitarias propuestas (ejecución por verificar).

## Seguridad y pasos antes de probar con datos reales
1. Ejecutar y aprobar pruebas CI y pruebas locales de API contra una base D1 temporal.
2. Revisar el esquema, autenticación y concurrencia. Se exige cuenta/espacio autorizado.
3. Configurar una D1 de prueba y el binding DB **solo** en un Worker de prueba aislado. No aplicar migraciones a producción.
4. Provisionar de forma segura dispositivos autorizados con hashes SHA-256; nunca poner tokens sin procesar en GitHub.
5. En el Worker de prueba, exponer la API /api y servir por el mismo origen pc.html/mobile-sync.html para evitar CORS. La configuración del Worker aún está pendiente.
6. Verificar con dos dispositivos: crear en móvil, ver PC, registrar QR, guardar kilos con Enter, cerrar desde PC y detectar cierre en móvil (también la operación inversa).
7. Probar pérdida de internet: la versión actual NO incluye cola offline; si no hay red, la captura debe indicar fallo. No usarla en producción hasta diseñar persistencia pendiente sin pérdida de registros.
8. Solo después de aprobar estas pruebas, planificar integrar el flujo de captura al lector principal original.

## Limitaciones actuales
- El código está guardado en una rama, pero no está desplegado, ni validado con una D1 real.
- La sincronización es por consulta cada 5 segundos, no instantánea.
- Al cerrar se bloquean nuevas escrituras. Un teléfono sin conexión puede tardar en enterarse del cierre.
- Los pesos pendientes y el cálculo de tara existen en el esquema, pero el formulario PC todavía requiere validar pruebas de extremo a extremo.
- La versión de prueba móvil solo asigna tara 41; seleccionar 44, controles de NN, zoom, historia, exportación y recuperación offline necesitan integrarse y probarse antes de reemplazar el lector original.
- Cierre de pesajes con pesos pendientes: decidir validación antes de producción.
