# Public Billposting

Spring Boot + Camunda 7 project for the public billposting assignment.

## What is included

- Spring Boot backend with REST APIs
- Camunda 7 process engine embedded in Spring Boot
- BPMN process in `src/main/resources/processes/public-billposting.bpmn`
- External service clients for:
  - `user-service.jar`
  - `zones-service.jar`
  - `posting-service.jar`
- PowerShell scripts to start and stop the whole stack

## Prerequisites

- Java 8
- Maven
- PowerShell
- The three service jars in `services/`

## Project ports

- Backend Spring Boot app: `8080`
- User service: `9080`
- Zones service: `9090`
- Posting service: `8888`

## How to start everything

From the project root, run:

```powershell
.\start-all.ps1
```

What this script does:

- starts `services\user-service.jar` on `9080`
- starts `services\zones-service.jar` on `9090`
- starts `services\posting-service.jar` on `8888`
- starts the backend with `mvn -DskipTests spring-boot:run` if Maven is available
- otherwise, starts `target\public-billposting-0.0.1-SNAPSHOT.jar` if it exists
- writes process info to `.run\processes.json`
- writes logs to `.run\logs\`

## How to stop everything

```powershell
.\stop-all.ps1
```

What this script does:

- reads `.run\processes.json`
- stops all recorded processes, including their child processes
- removes `.run\processes.json`
- removes `.run\logs\`

## Build the backend

If you want a packaged jar instead of `spring-boot:run`:

```powershell
mvn -DskipTests package
```

## API endpoints

### Request availability

`POST /api/requests/availability`

Example payload:

```json
{
  "username": "mariorossi",
  "posterFormat": "60x80",
  "selectionStrategy": "most-expensive-first",
  "cities": [
    {
      "city": "L'Aquila",
      "maxPrice": 100.0
    },
    {
      "city": "Pescara",
      "maxPrice": 80.0
    }
  ]
}
```

### Send decision

`POST /api/requests/decision`

Example payload:

```json
{
  "requestId": "03NzgXNyQE",
  "decision": "confirm"
}
```

## BPMN process

The BPMN process starts with a message correlation for the availability request, waits for the decision message, and then continues to completion with JavaScript script tasks.

## Notes

- The external service clients fall back to demo data if the jar-backed services are not reachable.
- Confirmed requests are appended to the output file configured by `app.output-file`.
- If you change ports or service locations, update `src/main/resources/application.properties` accordingly.
