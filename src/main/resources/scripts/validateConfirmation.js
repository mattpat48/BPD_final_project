// Validates the outcome of the "Confirm Request (SOAP)" call before the order is saved.
// The extractor scripts fall back to "N/A"/"0.0" when the SOAP envelope cannot be parsed,
// so a fault or an unexpected response would otherwise be silently written to file and
// returned to the user as a fake bill. Here we turn that into a controlled BPMN error,
// caught by the error event sub-process (same pattern as the other validations).
var system = java.lang.System;

var invoiceMissing = (invoiceNumber == null)
        || (String(invoiceNumber).trim().length === 0)
        || (String(invoiceNumber) === "N/A");
var amountMissing  = (amountDue == null)
        || (String(amountDue).trim().length === 0)
        || (String(amountDue) === "0.0");

if (invoiceMissing || amountMissing) {
    var msg = "The posting service did not return a valid bill on confirmation (requestId=" + requestId + ").";
    system.out.println("[VALIDATION] " + msg);
    execution.setVariable("errorCode", "POSTING_SERVICE_ERROR");
    execution.setVariable("errorMessage", msg);
    throw new org.camunda.bpm.engine.delegate.BpmnError("BUSINESS_ERROR", msg);
}

system.out.println("[VALIDATION] Confirmation bill valid. invoice=" + invoiceNumber + " amount=" + amountDue);
