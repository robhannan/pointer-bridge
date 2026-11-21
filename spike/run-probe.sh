#!/bin/sh
# Copy the probe to the TV and run it. Usage: spike/run-probe.sh [seconds]
# Needs root SSH on the TV (Homebrew Channel). TV_HOST: its address; TV_KEY: an SSH key (optional).
set -eu
TV=${TV_HOST:?set TV_HOST to the TV address}
KEYOPT=""; [ -n "${TV_KEY:-}" ] && KEYOPT="-i $TV_KEY -o IdentitiesOnly=yes"
SSH="ssh $KEYOPT -o BatchMode=yes -o ConnectTimeout=8 root@$TV"
DIR=$(cd "$(dirname "$0")" && pwd)
$SSH 'cat > /tmp/evdev-probe.js' < "$DIR/evdev-probe.js"
$SSH "echo fg: \$(luna-send -n 1 -w 4000 -f luna://com.webos.applicationManager/getForegroundAppInfo '{}' 2>&1 | grep appId); UV_THREADPOOL_SIZE=64 node /tmp/evdev-probe.js ${1:-15}"
