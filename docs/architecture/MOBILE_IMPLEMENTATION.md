# Mobile implementation and verification

The mobile application uses the shared editor and an in-process Rust kernel adapter. Vault access follows the mobile storage scope; note saves use content hashes and history rather than a desktop daemon. Touch controls, text direction, and recoverable drafts have focused browser coverage.

Android ARM64 native compilation and debug packaging are verified. The debug APK contains `classes.dex`, `AndroidManifest.xml`, and `lib/arm64-v8a/libscriptor_mobile_lib.so`; ZIP integrity verification reports no corrupt entry. The debug package is 151,488,290 bytes, including an unstripped native library of 144,335,032 bytes. This is a development artifact, not a size-optimized release.

Independent package inspection confirms an AArch64 ELF64 native library (ELF machine 183). Android's installed signature verifier accepts the APK with Signature Scheme v2 and one signer. The inspected APK SHA-256 is `54eeb734857bce66273a2f30219e62dd1a85d2ee3fccb2d772a0a50a48d94e6e`; it identifies this local debug artifact and is not a release attestation.

The standard Android command hit Windows symlink privileges during native-library staging. The project packaging helper accepts an already compiled native library, copies it into the generated ARM64 staging path, and invokes the generated build with a project-owned debug signing key. It validates the destination, restores its process environment, limits worker/memory use, and leaves the global Android keystore unchanged. Build artifacts and the local debug key are ignored by Git.

No Android device is currently attached. Device installation, lifecycle/permission behavior, and signed release packaging remain to be verified. iOS compilation and device verification require an Apple toolchain and are not claimed from this Windows host.
