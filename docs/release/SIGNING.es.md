# Estado de confianza de la versión y firma de distribuidores

[English](SIGNING.md) · [简体中文](SIGNING.zh-CN.md) · [Русский](SIGNING.ru.md) · [Deutsch](SIGNING.de.md) · **Español** · [فارسی](SIGNING.fa.md)

Scriptor separa la integridad de la publicación upstream de las firmas de editor que valida el sistema operativo.

## Política upstream

Las versiones oficiales de GitHub se publican deliberadamente **sin firma de editor**:

- no se requiere certificado de Windows;
- no se requiere Apple Developer ID ni credenciales de notarización;
- no se requiere una clave privada OpenPGP de Linux;
- el workflow de publicación no lee secretos de firma;
- las versiones de preview y de producción usan la misma política explícita de artefactos sin firmar;
- la publicación de producción sigue exigiendo evidencias completas de checksums, SBOM, recibo de publicación, identidad del código fuente, exact-subject y attestations de GitHub.

Así se evita la contradicción anterior: la creación de releases estaba nominalmente soportada, pero cada job de producción se detenía antes de compilar cuando faltaban secretos de firma en el repositorio.

## Evidencia del estado por destino

Cada build escribe `signing-evidence-<platform>-<architecture>.json` con el schema 2. El registro incluye:

- plataforma y arquitectura;
- canal preview o production;
- valores `signed`, `notarized` y `signatureType`;
- instrucciones para el verificador;
- commit exacto del código fuente;
- marca de tiempo de creación.

El workflow oficial escribe `signed: false`, `notarized: false` y `signatureType: "none"`. El verificador de publicación exige la matriz completa de destinos:

- Windows `x86_64`;
- macOS `aarch64`;
- Linux `x86_64`;
- Linux `aarch64`.

El verificador rechaza duplicados, destinos ausentes o inesperados, canales incorrectos y discrepancias del source commit. La publicación mueve los cuatro registros a `release-evidence`; el receipt schema 4 incorpora los mismos registros normalizados y verifica que coincidan byte por byte con esos metadatos. Los registros de confianza no son subjects de checksum ni de attestation del instalador.

## Comportamiento del sistema operativo

Como los instaladores upstream no están firmados:

- Windows SmartScreen puede indicar un editor desconocido;
- macOS Gatekeeper puede exigir que el usuario apruebe la apertura desde Ajustes del Sistema o el menú contextual de Finder;
- los paquetes de Linux dependen del checksum descargado y de la attestation de GitHub, no de una firma OpenPGP upstream del paquete.

Las notas de la versión deben explicar claramente estas limitaciones. La aplicación nunca debe afirmar que existe una firma Authenticode, notarización de Apple o firma OpenPGP que no esté realmente presente.

## Firma por un distribuidor downstream

Un distribuidor downstream puede firmar una copia del instalador con su propio certificado o mediante el proceso de su repositorio de paquetes. Eso produce bytes distintos y, por tanto, un checksum y un attestation subject diferentes a los del GitHub Release upstream.

El distribuidor downstream debe:

1. verificar primero el checksum upstream y la attestation de GitHub;
2. conservar el receipt upstream y el source commit;
3. firmar únicamente en su entorno de distribución controlado;
4. publicar nuevos checksums e instrucciones de verificación de firma bajo su propia identidad;
5. no sustituir nunca los assets upstream del release oficial de Scriptor.

El schema de evidencia puede representar un artefacto correctamente firmado para herramientas independientes, pero el CI upstream oficial no importa ni consume material privado de firma.

## Validación local

Validar la política sin secretos y la matriz de destinos:

```bash
node scripts/release/validate-signing-policy.mjs \
  --platform linux \
  --architecture x86_64 \
  --channel production
node --test scripts/release/signing-policy.test.mjs
```

Escribir un registro local de estado sin firma:

```bash
node scripts/release/write-signing-evidence.mjs \
  --platform linux \
  --architecture x86_64 \
  --channel production \
  --signed false \
  --notarized false \
  --signature-type none \
  --verifier "unsigned artifact; verify SHA-256 and GitHub attestation"
```

El verificador de releases sigue siendo fail-closed respecto a integridad y completitud aunque la firma del editor no sea un requisito previo.
