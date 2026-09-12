# Contribuir

[English](CONTRIBUTING.md) · [فارسی](CONTRIBUTING.fa.md) · [简体中文](CONTRIBUTING.zh-CN.md) · [Русский](CONTRIBUTING.ru.md) · [Deutsch](CONTRIBUTING.de.md) · **Español**

## Antes de cambiar código

1. Lea [`PRODUCT.es.md`](PRODUCT.es.md), [`DESIGN.es.md`](DESIGN.es.md), [`docs/ARCHITECTURE.es.md`](docs/ARCHITECTURE.es.md) y [`docs/CAPABILITY-MATURITY.es.md`](docs/CAPABILITY-MATURITY.es.md).
2. Para el onboarding de contribuidores, el mapa de directorios y los puntos de entrada, consulte [`docs/ONBOARDING.es.md`](docs/ONBOARDING.es.md).
3. Para packages de TypeScript, lea [`packages/README.md`](packages/README.md); importe packages únicamente mediante los entry points declarados.
4. Preserve cualquier trabajo staged, unstaged o untracked que no esté relacionado con su cambio.

## Toolchain

Los gates locales usan Node.js 22.12 o posterior (CI fija 22.16.0), pnpm 10.33.0, Rust 1.96.0 y PowerShell 7 (`pwsh`). Las comprobaciones de accesibilidad en navegador también necesitan un ChromeDriver que coincida con la versión de Chrome instalada; defina `CHROMEWEBDRIVER` si no se detecta automáticamente.

```powershell
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install --frozen-lockfile
rustup toolchain install 1.96.0 --profile minimal --component rustfmt --component clippy
rustup default 1.96.0
pwsh --version
```

## Desarrollo

```powershell
pnpm web:dev
pnpm desktop:dev
```

## Proceso de cambios

- Reproduzca los errores con una prueba que falle antes de aplicar la corrección.
- Mantenga revisables los cambios de mutación, refactorización, actualización de dependencias y archivos generados. Cuando un PR cambie la versión major o minor de una dependencia, audite en el mismo commit los call sites frente a las release notes upstream fijadas: un módulo o método renombrado (por ejemplo, `fs4` 1.x movió `fs_std::FileExt::lock_exclusive` a `FileExt::lock`) no compila en ninguna plataforma y el fallo oculta todos los gates posteriores.
- Canalice los comandos externos mediante `crates/system-bridge/src/process.rs`.
- Valide el JSON de runtime partiendo de `unknown`; no añada assertions sin comprobar en límites de confianza.
- Añada una clasificación de autorización para cada nuevo comando nativo.
- Use colas/colecciones/salidas acotadas para datos de larga duración o controlados por el usuario.
- Actualice primero los archivos source-of-truth y regenere después los contratos derivados.
- Actualice la documentación y el capability ledger cuando cambien la madurez o el soporte.

## Comprobaciones obligatorias

```powershell
pnpm version:check
pnpm lint:actions
pnpm lint:boundaries
pnpm check:i18n
pnpm check:docs
pnpm check:source
pnpm check:frontend-quality
pnpm lint
pnpm build
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
pnpm test:rust
```

`pnpm test:rust` replica el gate de Rust de CI: excluye `scriptor-desktop` (cubierto por `desktop-check.yml`) y los engines en incubación (`scriptor-embeddings`, `scriptor-tantivy-indexer`, `scriptor-wasm-runtime`) del conjunto de pruebas del producto, y luego ejecuta esos engines por separado mediante `test:rust:engines`. `scriptor-citation-engine` permanece en el grafo de pruebas del producto porque su parser BibLaTeX es una dependencia compatible del indexer; solo la superficie citeproc/rendering del crate sigue en incubación.

Ejecute los validadores específicos de package y las suites de Playwright relevantes para el comportamiento modificado. Los cambios de UI deben incluir evidencia de teclado, semántica para lectores de pantalla, estados loading/empty/error, viewport estrecho y zoom del 200 %.

`pnpm check:release` es un gate amplio de release, no el ciclo local de feedback más rápido. Empiece por las comprobaciones específicas anteriores y luego ejecute el gate completo en una máquina con los requisitos de escritorio/navegador instalados.

La terminología de evidencia y los gates de plataforma/release se definen en [`docs/VERIFICATION.es.md`](docs/VERIFICATION.es.md). Nunca describa una comprobación estática del código fuente como un resultado compilado, empaquetado, nativo o verificado en navegador.

## Pull requests

Describa:

- el comportamiento observable que cambió;
- los límites de autoridad/datos afectados;
- las pruebas y comandos ejecutados, con sus resultados;
- el comportamiento de migración/rollback;
- screenshots para cambios visibles;
- plataformas no verificadas o riesgos residuales.

No haga commit de secretos, directorios de build generados, logs de debug ni datos personales de vaults.

## Licencias

Salvo que se indique lo contrario, las contribuciones se licencian bajo **AGPL-3.0-or-later**. Al enviar una contribución, declara que tiene derecho a licenciarla bajo esos términos. Consulte [`COMMERCIAL-LICENSING.es.md`](COMMERCIAL-LICENSING.es.md) para la política de licencia separada.

## Seguridad

Informe de vulnerabilidades de forma privada según [`SECURITY.es.md`](SECURITY.es.md).
