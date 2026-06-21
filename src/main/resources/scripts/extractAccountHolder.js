var accountHolder = "N/A";
try {
    if (response != null && response.trim().length > 0) {
        var xml = S(response);
        accountHolder = xml.childElement("Body")
						.childElement("http://disim.univaq.it/services/postingservice", "confirmationResponse")
						.childElement("bill")
                     	.childElement("accountHolder").textContent();
    }
} catch(e) {
    java.lang.System.out.println("ERROR EXTRACTING ACCOUNT HOLDER: " + e.message);
}
accountHolder;