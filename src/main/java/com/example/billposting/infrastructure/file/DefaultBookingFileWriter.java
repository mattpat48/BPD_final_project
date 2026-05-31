package com.example.billposting.infrastructure.file;

import com.example.billposting.domain.BillingInformation;
import com.example.billposting.domain.BookingSession;
import java.io.BufferedWriter;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class DefaultBookingFileWriter implements BookingFileWriter {

    private final Path outputPath;
    private final Object lock = new Object();

    public DefaultBookingFileWriter(@Value("${app.output-file:posting_requests.txt}") String outputFile) {
        this.outputPath = Paths.get(outputFile);
    }

    @Override
    public void appendConfirmedRequest(BookingSession session, BillingInformation billingInformation) {
        synchronized (lock) {
            try {
                if (outputPath.getParent() != null) {
                    Files.createDirectories(outputPath.getParent());
                }
                try (BufferedWriter writer = Files.newBufferedWriter(outputPath, StandardCharsets.UTF_8,
                        StandardOpenOption.CREATE, StandardOpenOption.APPEND)) {
                    writer.write(formatLine(session.getUsername(), session.getRequestId(), billingInformation.getInvoiceNumber(), billingInformation.getAmountDue()));
                    writer.newLine();
                }
            } catch (IOException exception) {
                throw new IllegalStateException("Unable to write booking file", exception);
            }
        }
    }

    private String formatLine(String username, String requestId, String invoiceNumber, BigDecimal amountDue) {
        return username + ", " + requestId + ", " + invoiceNumber + ", " + amountDue.stripTrailingZeros().toPlainString() + ";";
    }
}
