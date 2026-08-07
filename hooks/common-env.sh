# Resolves a working `node` binary regardless of the hook subprocess's PATH
# (nvm shims, homebrew installs, etc. aren't always inherited by hooks).
# Sourced by the dispatcher scripts; sets $NODE_BIN.

resolve_node() {
  if command -v node >/dev/null 2>&1; then
    command -v node
    return
  fi
  for candidate in /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return
    fi
  done
  echo "node"
}

NODE_BIN="$(resolve_node)"
