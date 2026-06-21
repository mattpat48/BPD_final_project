var invoice = "N/A";
try {
    if (response != null && response.trim().length > 0) {
        var xml = S(response);
        invoice = xml.childElement("Body")
                     .childElement("http://disim.univaq.it/services/postingservice", "confirmationResponse")
                     .childElement("bill")
                     .childElement("invoiceNumber").textContent();
    }
} catch(e) {
    java.lang.System.out.println("ERROR EXTRACTING INVOICE: " + e.message);
}
invoice;