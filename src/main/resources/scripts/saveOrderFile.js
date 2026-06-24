// Writes the confirmed order to a per-request file. The file body is produced by the
// FreeMarker template templates/orderFile.ftl (rendered into the `fileContent` input variable
// by the task's input mapping), so all formatting and data assembly live in the template.
// This script only handles the I/O.
var system = java.lang.System;
var File = java.io.File;
var FileWriter = java.io.FileWriter;
var BufferedWriter = java.io.BufferedWriter;

try {
    var directory = new File("data/orders/confirmed");
    if (!directory.exists()) {
        directory.mkdirs();
    }

    var fileName = "data/orders/confirmed/order_" + requestId + ".txt";
    var bufferedWriter = new BufferedWriter(new FileWriter(fileName));
    bufferedWriter.write(fileContent);
    bufferedWriter.close();

    system.out.println("Order file successfully created at: " + fileName);

} catch (e) {
    system.err.println("Error creating order file: " + e.message);
}
