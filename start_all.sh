#!/usr/bin/env bash
set -euo pipefail

mkdir -p logs

services=(
	services/posting-service.jar
	services/user-service.jar
	services/zones-service.jar
)

for jar in "${services[@]}"; do
	name=$(basename "$jar" .jar)
	nohup java -jar "$jar" > "logs/$name.log" 2>&1 &
	pid=$!
	echo "$name started with PID $pid (logs/$name.log)"
done

echo "All services started."