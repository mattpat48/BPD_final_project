#!/usr/bin/env bash
set -euo pipefail

echo "Stopping services..."

# Function to find and kill a process by its JAR name
stop_service() {
    local jar_name=$1
    # Search for the process ID associated with the JAR name, excluding the grep process itself
    local pids=$(ps aux | grep "java -jar" | grep "$jar_name" | awk '{print $2}')
    
    if [ -n "$pids" ]; then
        for pid in $pids; do
            echo "Stopping $jar_name (PID: $pid)..."
            kill "$pid"
        done
    else
        echo "Service $jar_name is not running."
    fi
}

# Stop the external microservices
stop_service "posting-service.jar"
stop_service "user-service.jar"
stop_service "zones-service.jar"

# Stop the Camunda Engine
# The JAR name in target/ might vary, so we search generically for the project JAR
CAMUNDA_JAR=$(ls target/*.jar 2>/dev/null | grep -v original | head -n 1 || true)
if [ -n "$CAMUNDA_JAR" ]; then
    camunda_jar_name=$(basename "$CAMUNDA_JAR")
    stop_service "$camunda_jar_name"
else
    # Fallback if the target directory was deleted but the process is still running
    stop_service "BPD-Camunda-Project.jar"
fi

echo "All specified services have been stopped."