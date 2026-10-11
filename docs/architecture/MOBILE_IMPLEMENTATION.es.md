[English](MOBILE_IMPLEMENTATION.md) · [فارسی](MOBILE_IMPLEMENTATION.fa.md) · [简体中文](MOBILE_IMPLEMENTATION.zh-CN.md) · [Русский](MOBILE_IMPLEMENTATION.ru.md) · [Deutsch](MOBILE_IMPLEMENTATION.de.md) · **Español**

# Implementación y verificación móvil

La aplicación móvil utiliza el editor compartido y un adaptador del kernel de Rust dentro del proceso. El acceso al almacén sigue el ámbito de almacenamiento móvil; las notas se guardan mediante hashes de contenido e historial, en lugar de usar un daemon de escritorio. Los controles táctiles, la dirección del texto y los borradores recuperables cuentan con cobertura específica en pruebas de navegador.

Se han verificado la compilación nativa para Android ARM64 y el empaquetado de depuración. El APK de depuración contiene `classes.dex`, `AndroidManifest.xml` y `lib/arm64-v8a/libscriptor_mobile_lib.so`; la verificación de integridad ZIP no informa de ninguna entrada dañada. El paquete de depuración ocupa 151,488,290 bytes, incluida una biblioteca nativa sin eliminar símbolos de 144,335,032 bytes. Se trata de un artefacto de desarrollo, no de una versión optimizada en tamaño.

La inspección independiente del paquete confirma una biblioteca nativa AArch64 ELF64 (máquina ELF 183). El verificador de firmas instalado de Android acepta el APK con Signature Scheme v2 y un firmante. El SHA-256 del APK inspeccionado es `54eeb734857bce66273a2f30219e62dd1a85d2ee3fccb2d772a0a50a48d94e6e`; identifica este artefacto de depuración local y no constituye una atestación de versión.

El comando estándar de Android encontró las restricciones de Windows para crear enlaces simbólicos durante la preparación de la biblioteca nativa. El auxiliar de empaquetado del proyecto acepta una biblioteca nativa ya compilada, la copia en la ruta de preparación ARM64 generada e invoca la compilación generada con una clave de firma de depuración propiedad del proyecto. Valida el destino, restaura su entorno de proceso, limita el uso de workers y memoria, y no modifica el almacén global de claves de Android. Git ignora los artefactos de compilación y la clave de depuración local.

Actualmente no hay ningún dispositivo Android conectado. Quedan por verificar la instalación en dispositivos, el comportamiento del ciclo de vida y de los permisos, y el empaquetado de una versión firmada. La compilación y verificación en dispositivos iOS requieren una cadena de herramientas de Apple y no se declaran verificadas desde este host Windows.
