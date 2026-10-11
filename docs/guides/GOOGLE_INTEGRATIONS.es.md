# Integraciones de Google

[English](GOOGLE_INTEGRATIONS.md) · [فارسی](GOOGLE_INTEGRATIONS.fa.md) · [简体中文](GOOGLE_INTEGRATIONS.zh-CN.md) · [Русский](GOOGLE_INTEGRATIONS.ru.md) · [Deutsch](GOOGLE_INTEGRATIONS.de.md) · **Español**

Las integraciones experimentales de escritorio conectan Drive, Docs, Calendar, Tasks y Gmail con un vault local. Los archivos Markdown siguen siendo la fuente de verdad. Los cambios remotos se revisan antes de aplicarlos; conectar una cuenta no inicia la sincronización automática de todo el vault.

## Configurar y conectar

Abra **Settings → Integrations**, introduzca el ID público del cliente OAuth de Google para escritorio y guarde la configuración antes de abrir un espacio de integración. La sincronización de Calendar puede permanecer desactivada mientras utiliza Drive o Gmail.

El proyecto de Google debe tener activadas las API de los servicios elegidos y un cliente OAuth adecuado para una aplicación de escritorio instalada. Siga la [guía de Google](https://developers.google.com/identity/protocols/oauth2/native-app) para configurar el proyecto, la pantalla de consentimiento y el cliente. Scriptor abre el navegador del sistema para solicitar consentimiento. Introduzca el ID del cliente; nunca guarde un secreto de cliente ni un token de acceso en la configuración del vault.

Las conexiones son independientes: Drive y Docs comparten una, Calendar y Tasks otra, y Gmail tiene la suya. Conecte cada grupo que vaya a utilizar y compruebe la identidad de cuenta mostrada. Gmail también requiere activar su plugin. Los tokens se guardan en el llavero del sistema operativo; el ID público del cliente y los recursos seleccionados pertenecen a la configuración del vault.

## Compartir Markdown mediante Drive o Docs

Abra **Drive collaboration** desde la paleta de comandos. Explore carpetas accesibles, escriba un ID de carpeta o cree una carpeta tras revisar la solicitud de permiso de escritura. Elija el transporte y use **Save folder and transport** para conservar la selección en este vault.

Los registros JSON de Drive y los registros opacos de Google Docs transportan revisiones inmutables de Markdown. El formato de registro de Docs conserva los bytes Markdown; no convierte el documento en un editor de texto enriquecido. Revise la versión remota y resuelva los conflictos antes de aplicarla localmente. Compartir una revisión es una escritura explícita en el proveedor.

Los documentos normales de Google se exploran dentro de la carpeta seleccionada. Su conversión a texto es un flujo independiente, con aviso explícito de pérdida de formato y revisión del contenido. Exportar crea un documento nuevo, en lugar de reemplazar un documento enriquecido existente. Los archivos multimedia no se replican con estos registros Markdown. Consulte formatos, conflictos y límites de sondeo en el [contrato de colaboración](../validation/COLLABORATION_COMPLETION.md).

## Planificar con Calendar y Tasks

En Integrations, descubra calendarios y listas de tareas, seleccione los recursos deseados y guarde. Puede introducir identificadores manualmente si el descubrimiento no encuentra un recurso. Actualice la conexión después de cambiar sus permisos.

El espacio Tasks muestra tareas locales y el planificador semanal. Los bloques horarios locales siguen funcionando sin conexión. Una fecha de vencimiento de Google Tasks no representa una hora programada; los bloques con hora utilizan eventos de Calendar. Seleccione una tarea del vault, establezca inicio y fin y guarde el bloque local. También puede vincular explícitamente un evento existente con horario.

Use **Review bidirectional sync** para comparar los datos cargados del proveedor con las tareas y los bloques vinculados. Elija la dirección de cada cambio. Las escrituras necesitan permiso y las revisiones en conflicto requieren una nueva revisión. Un calendario de solo lectura se puede consultar e importar, pero no permite enviar eventos. La revisión cubre la ventana cargada y los vínculos explícitos, no todos los eventos de Google.

## Trabajar con Gmail

Active el plugin Gmail y abra **Gmail Manager**. Busque o actualice mensajes, cargue páginas adicionales y seleccione un mensaje para leer su texto sin formato. La lista visible tiene un límite; acote la búsqueda si hay más mensajes de los que puede contener.

Importar crea una nota Markdown nueva en el vault de origen. El texto se escapa para que el correo no se interprete como Markdown activo ni HTML. La importación no sobrescribe un destino existente. Archivar, enviar a la papelera y enviar correo son acciones independientes del proveedor que requieren revisión. La composición envía texto sin formato; si se rechaza el permiso o falla el envío, el borrador se conserva para corregirlo o volver a intentarlo.

## Desconectar y recuperar

Desconectar elimina el paquete local de credenciales seleccionado. Se descartan revisiones remotas preparadas y datos almacenados para esa cuenta, sin eliminar notas ni bloques horarios locales. Los vínculos a eventos no se reutilizan con otra cuenta o calendario. Una petición ya enviada a Google puede terminar después de cancelarla; cambiar de cuenta impide que su resultado obsoleto sustituya el nuevo espacio.

La desconexión local no revoca la autorización global de Google para la aplicación. Revóquela desde los permisos de su cuenta Google; esto puede afectar a varios servicios conectados.

| Problema | Qué hacer |
|---|---|
| Autenticación caducada o necesaria | Vuelva a conectar el servicio afectado y actualice sus datos. |
| Recurso ausente o acceso denegado | Compruebe cuenta, ID y permisos compartidos; vuelva a descubrir el recurso. |
| Fallo de paginación o descubrimiento | Actualice para iniciar otro recorrido; el descubrimiento parcial se rechaza. |
| Configuración sin guardar | Guarde antes de utilizar un enlace para abrir el espacio de trabajo. |
| Revisión remota modificada | Vuelva a obtenerla y prepare otra revisión antes de escribir. |

Estas integraciones siguen siendo experimentales. Los datos de prueba del navegador verifican el comportamiento sin acceder a cuentas Google. OAuth real, unidades compartidas y la aplicación de escritorio empaquetada necesitan verificaciones independientes con el proveedor y los dispositivos. Consulte el estado en el [registro de madurez](../CAPABILITY-MATURITY.md) y la evidencia en el [registro de verificación](../validation/GOOGLE-INTEGRATIONS-2026-10-09.md).
