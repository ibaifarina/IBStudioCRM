# Extractor de Google Maps para IBStudio CRM

## Instalación

1. Abre **Cuenta → Extractor de Google Maps** dentro del CRM.
2. Arrastra **Enviar negocio a IBStudio CRM** a la barra de marcadores, o usa **Copiar script** para instalarlo manualmente.
3. Si ya tenías la versión anterior, reemplázala: el nuevo script incluye la dirección exacta de tu CRM.

## Uso

Abre la ficha individual de un negocio en Google Maps y pulsa el marcador. El extractor envía los datos directamente a la pestaña del CRM, la enfoca y abre **Nuevo lead** con los campos ya rellenados. Si el CRM todavía no está abierto, crea una pestaña nueva y entrega los datos mediante un fragmento de URL que se elimina al recibirlo.

El extractor también intenta guardar una copia del bloque versionado (`IBSTUDIO_CRM_LEAD_V1`) como respaldo. El CRM nunca intenta leer el portapapeles automáticamente, por lo que macOS no muestra el botón de permiso **Pegar**. La importación manual sigue disponible en **Más opciones → Importar datos de Maps**.

Google Maps cambia su interfaz ocasionalmente. El extractor usa primero los atributos semánticos de Maps y conserva además otros detalles visibles como pares de etiqueta/valor para reducir la pérdida de información.
