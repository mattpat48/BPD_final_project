// Central handler reached through the error event sub-process whenever a validation
// task raises a BPMN error. It does NOT re-throw: it records the failure and lets the
// process end cleanly, so the engine never leaves a dangling/incident instance.
var system = java.lang.System;

var code = execution.getVariable("errorCode");
var msg = execution.getVariable("errorMessage");
execution.setVariable("processError", true);

system.out.println("\n========== PROCESS ERROR (handled) ==========");
system.out.println("Error code   : " + code);
system.out.println("Error detail : " + msg);
system.out.println("=============================================\n");
