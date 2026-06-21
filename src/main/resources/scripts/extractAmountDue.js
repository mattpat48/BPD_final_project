var amountDue = "0.0";
try {
    if (response != null && response.trim().length > 0) {
        var xml = S(response);
        var amountDue = xml.childElement("Body")
                            .childElement("http://disim.univaq.it/services/postingservice", "confirmationResponse")
                            .childElement("bill")
                            .childElement("amountDue").textContent();
    }
} catch(e) {
    java.lang.System.out.println("ERROR EXTRACTING AMOUNT: " + e.message);
}
amountDue;