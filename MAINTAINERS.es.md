# Mantenedores

[English](MAINTAINERS.md) · [فارسی](MAINTAINERS.fa.md) · [简体中文](MAINTAINERS.zh-CN.md) · [Русский](MAINTAINERS.ru.md) · [Deutsch](MAINTAINERS.de.md) · **Español**

## Mantenedor actual

Amirreza “Farnam” Taheri  
Correo: [taherifarnam@gmail.com](mailto:taherifarnam@gmail.com)  
GitHub: [@AmirrezaFarnamTaheri](https://github.com/AmirrezaFarnamTaheri)

## Modelo de propiedad

La base de código fuente subida no contiene el historial canónico de Git, por lo que la propiedad histórica y el factor bus no pueden demostrarse únicamente a partir de este artefacto. El repositorio incluye ahora [`.github/CODEOWNERS`](.github/CODEOWNERS), pero la aplicación efectiva de esas reglas por el hosting y la concentración real de revisiones deben verificarse en el repositorio canónico. Debe mantener:

- `CODEOWNERS` para las rutas de seguridad, release, kernel Rust, frontend y documentación;
- al menos dos revisores para cambios de release y cambios sensibles de seguridad;
- un informe trimestral de propiedad, churn e historial de secretos;
- tags de release inmutables y entornos de producción protegidos.

Hasta que se registren mantenedores adicionales, el mantenedor principal es el responsable de escalación de todas las áreas. Esto es un riesgo de continuidad, no una estructura de equipo inferida.

Genere evidencia local del historial desde un clon completo con:

```bash
bash scripts/governance/history-audit.sh . .history-audit
```

## Autoridad de release

Los releases de producción:

1. se originan en un tag `v<version>` que coincide con [`VERSION`](VERSION);
2. superan `.github/workflows/ci.yml` y los gates de compilación/empaquetado por plataforma;
3. usan el modelo de confianza documentado para instaladores sin firmar: identidad exacta del código fuente, checksums SHA-256, registros de estado de confianza vinculados al target, SBOM, recibo de release y attestations de procedencia de GitHub;
4. promueven exactamente los artefactos de build descargados, sin reconstruir durante la publicación;
5. publican los checksums, SBOM, recibo de release, metadatos de confianza y attestations exigidos por el contrato de evidencia de release.

Consulte [`docs/RELEASE-SECURITY.es.md`](docs/RELEASE-SECURITY.es.md).

## Soporte y escalación

| Tema | Canal |
|---|---|
| Seguridad | Correo privado según [`SECURITY.es.md`](SECURITY.es.md) |
| Bugs/funciones | GitHub Issues |
| Contribuciones | [`CONTRIBUTING.es.md`](CONTRIBUTING.es.md) |
| Licencias | [`COMMERCIAL-LICENSING.es.md`](COMMERCIAL-LICENSING.es.md) |
| Estado de capacidades | [`docs/CAPABILITY-MATURITY.es.md`](docs/CAPABILITY-MATURITY.es.md) |
