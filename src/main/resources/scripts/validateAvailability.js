// Validates the outcome of the "Check Availability (SOAP)" call.
// extractRequestId.js / extractAvailability.js already parsed the SOAP envelope into
// `requestId` (string, "N/A" on failure) and `isAvailable` (string "true"/"false").
// Here we turn an unusable answer into a controlled BPMN error so the process never
// continues towards the wait state with a meaningless request.
var system = java.lang.System;

var reqMissing = (requestId == null) || (String(requestId).trim().length === 0) || (String(requestId) === "N/A");
if (reqMissing) {
    var m1 = "The posting service did not return a valid request ID.";
    system.out.println("[VALIDATION] " + m1);
    execution.setVariable("errorCode", "POSTING_SERVICE_ERROR");
    execution.setVariable("errorMessage", m1);
    throw new org.camunda.bpm.engine.delegate.BpmnError("BUSINESS_ERROR", m1);
}

if (isAvailable == null || String(isAvailable) !== "true") {
    var m2 = "The selected zones are not available for the requested posting.";
    system.out.println("[VALIDATION] " + m2);
    execution.setVariable("errorCode", "NOT_AVAILABLE");
    execution.setVariable("errorMessage", m2);
    throw new org.camunda.bpm.engine.delegate.BpmnError("BUSINESS_ERROR", m2);
}

system.out.println("[VALIDATION] Availability confirmed. requestId=" + requestId);
