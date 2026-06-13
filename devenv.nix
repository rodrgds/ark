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
      # Cap V8 heap at 1GB to keep the runner's OOM in check on
      # small-memory hosts (3–4GB). The default Node heap is ~1.7GB
      # and tsc / vitest / eslint will reliably OOM it.
      export NODE_OPTIONS="--max-old-space-size=1024"
      cd "${config.git.root}"
      bun install --frozen-lockfile
      bunx prettier --check .
    '';
  };

  typecheck-wrapper = pkgs.writeShellApplication {
    name = "typecheck-wrapper";
    runtimeInputs = [ pkgs.bun ];
    text = ''
      export NODE_OPTIONS="--max-old-space-size=1024"
      cd "${config.git.root}"
      bun install --frozen-lockfile
      bunx tsc --noEmit
    '';
  };

  lint-wrapper = pkgs.writeShellApplication {
    name = "lint-wrapper";
    runtimeInputs = [ pkgs.bun ];
    text = ''
      export NODE_OPTIONS="--max-old-space-size=1024"
      cd "${config.git.root}"
      bun install --frozen-lockfile
      bunx eslint . --quiet
    '';
  };

  test-wrapper = pkgs.writeShellApplication {
    name = "test-wrapper";
    runtimeInputs = [ pkgs.bun ];
    text = ''
      export NODE_OPTIONS="--max-old-space-size=1024"
      cd "${config.git.root}"
      bun install --frozen-lockfile
      bun test
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

  scripts = {
    install.exec = "bun install --frozen-lockfile";
    format.exec = "bunx prettier --write .";
    # CI-friendly counterpart of `format`: exits non-zero on any unformatted
    # file instead of rewriting in place.
    format-check.exec = "${lib.getExe prettier-check-wrapper}";
    typecheck.exec = "bunx tsc --noEmit";
    lint.exec = "bun run lint";
    test.exec = "bun test";
  };

  git-hooks.hooks = {
    prettier-check = {
      enable = true;
      entry = "${lib.getExe prettier-check-wrapper}";
      files = ".";
      pass_filenames = false;
    };
    typecheck = {
      enable = true;
      entry = "${lib.getExe typecheck-wrapper}";
      files = ".";
      pass_filenames = false;
    };
    lint = {
      enable = true;
      entry = "${lib.getExe lint-wrapper}";
      files = ".";
      pass_filenames = false;
    };
    test = {
      enable = true;
      entry = "${lib.getExe test-wrapper}";
      files = ".";
      pass_filenames = false;
    };
  };

  enterShell = ''
    echo ""
    echo "  Ark — Development Environment"
    echo "  -----------------------------"
    echo "  Bun:    $(bun --version 2>/dev/null || echo 'not installed')"
    echo ""
    echo "  Commands:"
    echo "    install   - bun install --frozen-lockfile"
    echo "    format    - prettier --write ."
    echo "    typecheck - tsc --noEmit"
    echo "    lint      - eslint . --quiet"
    echo "    test      - bun test"
    echo ""
  '';

  enterTest = ''
    bun --version
    git --version
  '';
}
