#!/usr/bin/env bash
set -euo pipefail

mkdir -p logs

echo "Starting external services..."
services=(
    services/posting-service.jar
    services/user-service.jar
    services/zones-service.jar
)

for jar in "${services[@]}"; do
    if [ -f "$jar" ]; then
        name=$(basename "$jar" .jar)
        nohup java -jar "$jar" > "logs/$name.log" 2>&1 &
        pid=$!
        echo "Started: $name (PID $pid)"
    else
        echo "Warning: $jar not found, ignored."
    fi
done

echo "Compiling Camunda project..."
mvn clean package -DskipTests -q

echo "Starting Camunda Engine..."
CAMUNDA_JAR=$(ls target/*.jar | grep -v original | head -n 1)

if [ -z "$CAMUNDA_JAR" ]; then
    echo "Error: JAR not found in target/."
    exit 1
fi

nohup java -jar "$CAMUNDA_JAR" > logs/camunda.log 2>&1 &
camunda_pid=$!
echo "Started: Camunda (PID $camunda_pid)"

echo -n "Waiting for Camunda to start on port 8080..."
while ! curl -s -f http://localhost:8080/engine-rest/engine > /dev/null; do
    echo -n "."
    sleep 2
done
echo " OK."

echo "Starting BPMN Request Branch..."
RESPONSE=$(curl -s -X GET http://localhost:8080/api/request/start)

echo "Response: $RESPONSE"

echo "Starting BPMN Decision Branch..."
RESPONSE=$(curl -s -X GET http://localhost:8080/api/decision/start)

echo "Response: $RESPONSE"

echo "Script completed (Runtime output visible in: logs/camunda.log)"