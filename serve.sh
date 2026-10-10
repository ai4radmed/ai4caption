#!/usr/bin/env bash
# http://localhost 로 열어야 마이크·BroadcastChannel 이 동작한다 (file:// 불가)
cd "$(dirname "$0")" && python3 -m http.server 8765
