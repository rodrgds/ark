{
  config,
  lib,
  pkgs,
  ...
}:
let
  # Nixpkgs' Bun build can require newer x86-64 CPU features than older NAS
  # hosts provide. Use Bun's official baseline build and pin its contents.
  rawBun = pkgs.stdenvNoCC.mkDerivation {
    pname = "bun";
    version = "1.3.3";

    src = pkgs.fetchzip {
      url = "https://github.com/oven-sh/bun/releases/download/bun-v1.3.3/bun-linux-x64-baseline.zip";
      hash = "sha256-RY9FSb9iXm2+mmy2BIhhPbdFovsv0agz/eT0jfaspl0=";
    };

    nativeBuildInputs = [ pkgs.autoPatchelfHook ];
    buildInputs = [ pkgs.stdenv.cc.cc.lib ];
    dontUnpack = true;

    installPhase = ''
      runHook preInstall
      install -Dm755 "$src/bun" "$out/bin/bun"
      ln -s bun "$out/bin/bunx"
      runHook postInstall
    '';
  };

  # Node parses dotenv files as data. Bun is then exec'd with dotenv loading
  # disabled, so no dotenv file is ever sourced/eval'd or copied to the store.
  bunLauncher = pkgs.writeText "ark-bun-launcher.mjs" ''
    import { execve } from "node:process";

    const [bunCommand, ...args] = process.argv.slice(2);
    execve(bunCommand, [bunCommand, "--no-env-file", ...args], process.env);
  '';

  mkBunWrapper =
    name:
    pkgs.writeShellApplication {
      inherit name;
      text = ''
        env_args=()
        for env_file in .env .env.local; do
          if [[ -f "$env_file" ]]; then
            env_args+=("--env-file=$env_file")
          fi
        done

        exec "${pkgs.nodejs_22}/bin/node" "''${env_args[@]}" \
          "${bunLauncher}" "${rawBun}/bin/${name}" "$@"
      '';
    };

  bun = mkBunWrapper "bun";
  bunx = mkBunWrapper "bunx";
  bunWrappers = pkgs.symlinkJoin {
    name = "ark-bun-wrappers";
    paths = [
      bun
      bunx
    ];
  };

  prettier-check-wrapper = pkgs.writeShellApplication {
    name = "prettier-check-wrapper";
    runtimeInputs = [ bunWrappers ];
    text = ''
      cd "${config.git.root}"
      exec bunx prettier --check .
    '';
  };
  typecheck-wrapper = pkgs.writeShellApplication {
    name = "typecheck-wrapper";
    runtimeInputs = [ bunWrappers ];
    text = ''
      cd "${config.git.root}"
      exec bunx tsc --noEmit
    '';
  };
  lint-wrapper = pkgs.writeShellApplication {
    name = "lint-wrapper";
    runtimeInputs = [ bunWrappers ];
    text = ''
      cd "${config.git.root}"
      exec bunx eslint . --quiet
    '';
  };
  test-wrapper = pkgs.writeShellApplication {
    name = "test-wrapper";
    runtimeInputs = [ bunWrappers ];
    text = ''
      cd "${config.git.root}"
      exec bun run test
    '';
  };

  frozenInstall = pkgs.writeShellApplication {
    name = "ark-frozen-install";
    runtimeInputs = [
      pkgs.coreutils
      pkgs.gnupatch
      pkgs.gnused
      pkgs.jq
    ];
    text = ''
      project_root="${config.git.root}"
      # Stage beside the checkout, never in /tmp. The old dependency tree stays
      # usable if resolution or a patched dependency fails.
      install_root=$(mktemp -d "$project_root/../.ark-install.XXXXXX")
      trap 'rm -rf "$install_root"' EXIT

      # Bun's patch reader can fail with EINVAL on the Hermes NAS filesystem
      # while still exiting zero. Install the frozen graph without that phase,
      # then apply the same committed patches with portable Unix tooling.
      jq 'del(.patchedDependencies)' "$project_root/package.json" \
        > "$install_root/package.json"
      cp "$project_root/bun.lock" "$install_root/bun.lock"

      mkdir -p "$install_root/modules"
      for module in "$project_root"/modules/*; do
        if [[ -f "$module/package.json" ]]; then
          module_name="''${module##*/}"
          mkdir -p "$install_root/modules/$module_name"
          cp "$module/package.json" "$install_root/modules/$module_name/package.json"
        fi
      done

      cd "$install_root"
      env -i \
        HOME="$HOME" \
        PATH="${rawBun}/bin:${pkgs.nodejs_22}/bin:${pkgs.coreutils}/bin:${pkgs.gnutar}/bin:${pkgs.gzip}/bin" \
        "${rawBun}/bin/bun" --no-env-file install --frozen-lockfile \
          --backend=copyfile "$@"

      patch --batch --forward -d "$install_root/node_modules/@10play/tentap-editor" \
        -p1 < "$project_root/patches/@10play%2Ftentap-editor@1.0.1.patch"
      touch "$install_root/node_modules/uniwind/.bun-tag-3a8b1a1fdb1feee3"
      sed -n '/^diff --git a\/src\/components\/index.ts/,$p' \
        "$project_root/patches/uniwind@1.6.3.patch" \
        | patch --batch --forward -d "$install_root/node_modules/uniwind" -p1

      # copyfile materializes staged local workspaces with only package.json.
      # Restore relative links so moving node_modules keeps live module source.
      for module in "$project_root/modules"/*; do
        [[ -f "$module/package.json" ]] || continue
        module_name="''${module##*/}"
        rm -rf "$install_root/node_modules/$module_name"
        ln -s "../modules/$module_name" "$install_root/node_modules/$module_name"
      done

      rm -rf "$project_root/node_modules"
      mv "$install_root/node_modules" "$project_root/node_modules"
    '';
  };
in
{
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_22;
    bun = {
      enable = true;
      package = bunWrappers;
    };
  };

  packages = [
    pkgs.git
    pkgs.gnutar
    pkgs.gzip
    pkgs.ripgrep
  ];

  env.NODE_OPTIONS = "--max-old-space-size=1024";
  dotenv.disableHint = true;

  scripts = {
    install.exec = "${frozenInstall}/bin/ark-frozen-install";
    # Ark currently has no committed env template. Setup intentionally installs
    # dependencies only and never creates or overwrites a developer env file.
    setup.exec = "${frozenInstall}/bin/ark-frozen-install";
    dev.exec = "bun run dev";
    check.exec = "bun run check";
    typecheck.exec = "bun run typecheck";
    format-check.exec = "bun run format:check";
    lint.exec = "bun run lint";
    test.exec = "bun run test";
    build-or-docs.exec = "bun run build-or-docs";
    verify.exec = "bun run verify";
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
    echo "  Bun:  $(bun --version) (official x64 baseline)"
    echo "  Node: $(node --version)"
    echo ""
    echo "  setup          Frozen dependency install; never writes env files"
    echo "  install        Frozen dependency install"
    echo "  dev            Start the Expo development server"
    echo "  check          Typecheck, lint, and test"
    echo "  typecheck      Run TypeScript checks"
    echo "  format-check   Check formatting without changing files"
    echo "  lint           Run ESLint"
    echo "  test           Run unit and mounted UI tests"
    echo "  build-or-docs  Check documentation and build VitePress docs"
    echo "  verify         Run source/docs gates; no native or Android build"
    echo ""
  '';

  enterTest = ''
    bun --version
    bun -e 'console.log("bun runtime ok")'
    node --version
    git --version
  '';
}
