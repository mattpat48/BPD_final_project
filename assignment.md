# Scenario description
## Public billposting service
It is required to realize a system that allows users to book spaces for public billposting.
1. The user specifies the cities (one or more) where she wants to affix posters, the poster format
(e.g., 60x80, 200x100, etc.), and the maximum price that can be paid for each of the selected
cities. Those information are sent through an API.
2. After having received the message from the exposed API, the process gets the user details (user
personal data) and the list of the available zones of the cities where posters can be affixed (with
the prices) from two web services.
3. For each chosen city, zones need to be selected in such a way that their total price is lower than
the maximum price. Zones are chosen by taking the most expensive ones until the maximum
price is reached.
4. A posting service is invoked sending the list of the selected zones and the user details. It will
return a request ID.
5. The request ID and the list of the selected zones are returned to the user
6. The user sends a message with the request ID and the decision: "confirm" or "cancel"
If the decision is "confirm":
7. The confirmation is sent to the posting service. The service will return the billing information
with the total amount due.
8. The order information are printed into a file
9. The billing information are returned to the user
If the decision is "cancel":
7. The order cancelation is sent to the posting service
8. A cancelation notice is printed in the standard output
9. An empty bill is returned to the user

# Project Requirements
Students are required
- To model a BPMN process realizing the described scenario
- The BPMN process must be executed through the Camunda platform embedded into a Spring Boot project
- The project must expose two API endpoints (REST or SOAP)
- The API endpoints must interact with the process and start/resume its execution through messages
- Messages must be correlated
- Communication with external services must be implemented by using connectors
- Extra tasks may be added to perform extra computation (e.g., zones selection)

# APIs to expose
- Can be realized as REST or SOAP services
- If REST, methods (GET, POST, etc.) can be chosen according to what is the best-fitting …choose wisely
## Request availability
- Input data:
    - Username
    - List of cities
    - Maximum price for each of the listed cities
    - Poster format
- Output data:
    - List of selected zones
    - Total price
    - Request ID
## Send decision
- Input data:
    - Request ID
    - Decision ("confirm" or "cancel")
- Output data:
    - Billing information

# Output
Add a new line into a file named "posting_requests.txt"
- Create the file if it does not exist
- Line format: username, request ID, invoice number, amount due;
- Example:
    - mariorossi, 03NzgXNyQE, 2057718223, 21.2;
    - sarabianchi, 7uu2kCpFPX, 6390163826, 89.9;
- Or (better) create a file for each confirmed request
- Add all the user information, request information, zone lists, invoice number, amount due;

# Error management
- When realizing the application's (REST or SOAP) interface, account for possibly wrong/inadmissible inputs or any other possible process-related fault
- Avoid that error messages (e.g., 500 internal server error) are returned to the user in an unmanaged way
- Avoid that the process "gets lost" due to wrong inputs
- Use HTTP status codes to "prettify" and add semantics to possible error messages
- The final application should be robust to errors and faults
- Develop multiple zones selection strategies and let the user choose which one to use
- Prefer using templates if are needed
- Complex connector inputs
- Generated file (if choosing to write a file for each single request)
- You may extend the system with more features if you find them useful

# Services to compose
- Available as *.jar files in the Team class material
- user-service.jar, zones-service.jar, posting-service.jar
- Run from terminal with java -jar command
- Es.: java -jar user-service.jar
- Java 8 required
- To run the services
- To run the Camunda engine with Javascript tasks