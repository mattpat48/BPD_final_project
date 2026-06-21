var system = java.lang.System;
system.out.println("\n=== SOAP RAW RESPONSE ===");
system.out.println(response);
system.out.println("=========================\n");

var reqId = "N/A";
try {
    if (response != null && response.trim().length > 0) {
        var xml = S(response);
        reqId = xml.childElement("Body").childElement("http://disim.univaq.it/services/postingservice", "availabilityResponse").childElement("requestId").textContent();
    } else {
        system.out.println("ERROR: The SOAP server response is empty (Premature EOF)!");
    }
} catch(e) {
    system.out.println("ERROR PARSING XML: " + e.message);
}
reqId;