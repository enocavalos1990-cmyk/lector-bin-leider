# Plan de trabajo: sincronización celular y PC

## Estado base (17-10-2026)
- Rama original: `main`. No modificar ni desplegar sin validación.
- Rama de trabajo: `sincronizacion-celular-pc`.
- Aplicación actual: `index.html` con cámara QR, tara 41/44, pesos acumulados, historial y exportación Excel.
- Los datos se guardan en `localStorage` (STORAGE_KEY, SESSION_KEY, HISTORY_KEY, RECEPTION_KEY); no existe sincronización entre navegadores.
- Actualmente `addWeights()` recibe 1 a 3 pesos acumulados; `assignQr()` relaciona lecturas QR con el siguiente peso pendiente.
- `stopWeighing()` guarda el pesaje localmente, limpia la lista activa e inicia el siguiente flujo.

## Objetivo
Permitir escanear desde Samsung A54 y consultar/modificar el mismo pesaje en PC, ingresando kilos por BIN con Enter para guardar y avanzar, manteniendo el orden de captura y exportación.

## Reglas funcionales
1. Un pesaje tiene un ID persistente, fecha, estado (activo/finalizado) y filas numeradas con un ID estable.
2. Una fila puede tener QR sin peso o peso sin QR; completar nunca cambia el orden previo.
3. El PC edita bruto por fila; neto = bruto - tara de esa fila. No borrar ni recalcular pesajes cerrados sin edición explícita.
4. Enter guarda la fila actual y enfoca la siguiente pendiente; no cierra el pesaje.
5. Las nuevas lecturas de móvil se agregan sin desplazar la fila enfocada en PC.
6. Evitar duplicados y escritura concurrente accidental; emplear revisión/versión por registro.
7. Sin conexión, conservar operaciones pendientes localmente, reintentar sincronización y mostrar estado. Nunca anunciar sincronizado antes de confirmación del servidor.
8. Proteger acceso a los pesajes. No abrir endpoints públicos de lectura/escritura sin autenticación/autorización.
9. Mantener las funciones anteriores y exportar Excel en orden de fila.

## Etapas separadas y verificables
- **A. Diseño de datos y contrato de API**: crear modelo D1, endpoints autenticados por usuario/dispositivo, validaciones, esquema de versiones y pruebas.
- **B. Backend de pruebas**: crear/consultar pesajes, registrar QR, editar bruto, finalizar; probar duplicados, concurrencia, autorización y persistencia.
- **C. Integración móvil**: sincronización de lecturas, cola offline e indicadores sin alterar el escáner.
- **D. Panel PC**: listado de pesajes, edición por fila con Enter, actualización de lecturas nuevas sin interrumpir edición.
- **E. Excel e impresión**: exportar filas de la sesión sincronizada, historial y comprobaciones.
- **F. Pruebas extremo a extremo**: 2 dispositivos, desconexión/reconexión, reinicio, duplicados, fila faltante, tara, cierre y exportación.

## Criterios de aceptación
- QR leído en móvil aparece en PC en un pesaje activo.
- Peso escrito en PC aparece en el registro compartido y sobrevive recarga.
- Enter pasa al siguiente BIN sin cerrar pesaje.
- El orden de las filas no cambia tras lectura adicional o corrección.
- Excel conserva orden, bruto, neto, tara y QR.
- La versión pública sigue funcionando hasta aprobar despliegue de prueba.

## Restricciones
No tocar `main` durante el desarrollo. No desplegar automáticamente desde esta rama sin revisar configuración del proyecto.