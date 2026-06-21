var isAvail = "false";
try {
    if (response != null && response.trim().length > 0) {
        var xml = S(response);
        isAvail = xml.childElement("Body").childElement("http://disim.univaq.it/services/postingservice", "availabilityResponse").childElement("available").textContent();
    }
} catch(e) {
    // Handled in the requestId script
}
isAvail;