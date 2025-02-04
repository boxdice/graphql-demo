#!/bin/sh
set -e

npm install

: "${CONCURRENCY:=1}"

pids=""

for i in $(seq 1 "$CONCURRENCY"); do
  echo "Launching process $i..."
  PROCESS_NUM=$i npm run start &
  pids="$pids $!"
  sleep 10
done

trap 'kill -TERM $pids' TERM INT

wait 