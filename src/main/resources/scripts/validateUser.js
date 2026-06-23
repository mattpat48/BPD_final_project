// Validates the response of the "Get User Data" REST call.
// The connector mapped the raw body into `userResponse` and the HTTP code into `userStatusCode`.
// If the user does not exist the service answers 404 with an empty body: instead of letting
// S(userResponse) explode with a SPIN parse error, we raise a controlled BPMN error.
var system = java.lang.System;

var bodyEmpty = (userResponse == null) || (String(userResponse).trim().length === 0);
var badStatus = (userStatusCode == null) || (Number(userStatusCode) !== 200);

if (badStatus || bodyEmpty) {
    var msg = "User '" + username + "' was not found (HTTP " + userStatusCode + ").";
    system.out.println("[VALIDATION] " + msg);
    execution.setVariable("errorCode", "USER_NOT_FOUND");
    execution.setVariable("errorMessage", msg);
    throw new org.camunda.bpm.engine.delegate.BpmnError("BUSINESS_ERROR", msg);
}

// Body is valid JSON: turn it into a Spin object so the FreeMarker SOAP template can read it.
execution.setVariable("userData", S(userResponse));
system.out.println("[VALIDATION] User '" + username + "' resolved correctly.");
