{
  config,
  pkgs,
  lib,
  ...
}:
let
  prettier-check-wrapper = pkgs.writeShellApplication {
    name = "prettier-check-wrapper";
    runtimeInputs = [ pkgs.bun ];
    text = ''
      export BUN_TMPDIR="''${BUN_TMPDIR:-/tmp/bun-tmp}"
      if [ ! -w "''${BUN_INSTALL:-/tmp/bun-install}" ]; then
        export BUN_INSTALL="/tmp/bun-install"
      else
        export BUN_INSTALL="''${BUN_INSTALL:-/tmp/bun-install}"
      fi
      export TMPDIR="''${TMPDIR:-/tmp/bun-tmp}"
      mkdir -p "$BUN_TMPDIR" "$TMPDIR"
      mkdir -p "$BUN_INSTALL"
      cd "${config.git.root}"
      bun install --frozen-lockfile
      bunx prettier --check .
    '';
  };
in
{
  languages.javascript = {
    enable = true;
    bun.enable = true;
  };

  packages = [
    pkgs.bun
    pkgs.git
    pkgs.ripgrep
  ];

  env.NODE_OPTIONS = "--max-old-space-size=1024";

  scripts = {
    install.exec = "bun install --frozen-lockfile";
    format.exec = "bunx prettier --write .";
    typecheck.exec = "bunx tsc --noEmit";
    lint.exec = "bun run lint";
    test.exec = "bun run test";
  };

  git-hooks.hooks.prettier-check = {
    enable = true;
    entry = "${lib.getExe prettier-check-wrapper}";
    files = ".";
    pass_filenames = false;
  };

  enterTest = ''
    bun --version
    git --version
  '';
}
