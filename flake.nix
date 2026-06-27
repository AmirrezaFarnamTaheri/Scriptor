{
  description = "Scriptor development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, rust-overlay, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs { inherit system overlays; };

        rustToolchain = pkgs.rust-bin.stable.latest.default.override {
          extensions = [ "clippy" "rustfmt" ];
        };

        linuxDeps = pkgs.lib.optionals pkgs.stdenv.isLinux [
          pkgs.webkitgtk_4_1
          pkgs.libappindicator-gtk3
          pkgs.librsvg
          pkgs.gtk3
          pkgs.libsoup_3
          pkgs.pango
          pkgs.cairo
          pkgs.gdk-pixbuf
          pkgs.atk
        ];
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            rustToolchain
            pkgs.nodejs_22
            pkgs.corepack
            pkgs.git
            pkgs.pkg-config
            pkgs.openssl
          ] ++ linuxDeps;

          shellHook = ''
            echo "Scriptor dev shell ready"
            echo "  rust: $(rustc --version)"
            echo "  node: $(node --version)"
          '';
        };
      }
    );
}
