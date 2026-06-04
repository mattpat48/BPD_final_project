package com.example.billposting.infrastructure.posting;

import com.example.billposting.domain.BillingInformation;
import com.example.billposting.domain.BookingSession;
import com.example.billposting.domain.SelectedZone;
import com.example.billposting.domain.UserDetails;
import java.io.StringReader;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import javax.xml.parsers.DocumentBuilderFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.ws.client.core.WebServiceTemplate;
import org.springframework.ws.soap.saaj.SaajSoapMessageFactory;
import org.springframework.xml.transform.StringResult;
import org.springframework.xml.transform.StringSource;
import org.w3c.dom.Document;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

@Component
public class DemoPostingServiceClient implements PostingServiceClient {

    private static final String NAMESPACE = "http://disim.univaq.it/services/postingservice";

    private final String postingSoapUrl;
    private final WebServiceTemplate webServiceTemplate;

    public DemoPostingServiceClient(@Value("${app.services.posting-soap-url:}") String postingSoapUrl) {
        this.postingSoapUrl = postingSoapUrl;
        SaajSoapMessageFactory messageFactory = new SaajSoapMessageFactory();
        messageFactory.afterPropertiesSet();
        this.webServiceTemplate = new WebServiceTemplate(messageFactory);
    }

    @Override
    public String createPostingRequest(UserDetails userDetails, List<SelectedZone> selectedZones) {
        if (!StringUtils.hasText(postingSoapUrl)) {
            return createDemoRequestId();
        }

        String requestXml = buildAvailabilityRequestXml(userDetails, selectedZones);
        StringResult result = new StringResult();
        webServiceTemplate.sendSourceAndReceiveToResult(postingSoapUrl, new StringSource(requestXml), result);

        Document document = parse(result.toString());
        String available = findText(document, "available");
        if (StringUtils.hasText(available) && !Boolean.parseBoolean(available)) {
            throw new IllegalStateException("Posting service reported that the request is not available");
        }

        String requestId = findText(document, "requestId");
        if (!StringUtils.hasText(requestId)) {
            throw new IllegalStateException("Posting service did not return a requestId");
        }
        return requestId;
    }

    @Override
    public BillingInformation confirm(String requestId, BookingSession session) {
        if (!StringUtils.hasText(postingSoapUrl)) {
            return new BillingInformation(generateInvoiceNumber(), session.getTotalPrice());
        }

        StringResult result = new StringResult();
        webServiceTemplate.sendSourceAndReceiveToResult(postingSoapUrl,
                new StringSource(buildConfirmationRequestXml(requestId)), result);

        Document document = parse(result.toString());
        String invoiceNumber = findText(document, "invoiceNumber");
        String amountDue = findText(document, "amountDue");
        if (!StringUtils.hasText(invoiceNumber) || !StringUtils.hasText(amountDue)) {
            throw new IllegalStateException("Posting service confirmation response is incomplete");
        }
        return new BillingInformation(invoiceNumber, BigDecimal.valueOf(Double.parseDouble(amountDue)));
    }

    @Override
    public void cancel(String requestId, BookingSession session) {
        if (!StringUtils.hasText(postingSoapUrl)) {
            return;
        }

        webServiceTemplate.sendSourceAndReceiveToResult(postingSoapUrl,
                new StringSource(buildCancelRequestXml(requestId)), new StringResult());
    }

    private String buildAvailabilityRequestXml(UserDetails userDetails, List<SelectedZone> selectedZones) {
        StringBuilder builder = new StringBuilder();
        builder.append("<checkAvailability xmlns=\"").append(NAMESPACE).append("\">");
        builder.append("<applicant>");
        builder.append(tag("name", valueOrEmpty(userDetails.getName())));
        builder.append(tag("surname", valueOrEmpty(userDetails.getSurname())));
        builder.append(tag("taxCode", valueOrEmpty(userDetails.getTaxCode())));
        builder.append(tag("address", valueOrEmpty(userDetails.getAddress())));
        builder.append(tag("city", valueOrEmpty(userDetails.getCity())));
        builder.append(tag("zip", userDetails.getZipCode() == null ? "" : String.valueOf(userDetails.getZipCode())));
        builder.append(tag("email", valueOrEmpty(userDetails.getEmail())));
        builder.append("</applicant>");
        builder.append("<posting>");
        builder.append(tag("posterFormat", selectedZones.isEmpty() ? "" : valueOrEmpty(selectedZones.get(0).getPosterFormat())));
        for (SelectedZone selectedZone : selectedZones) {
            builder.append("<zone>");
            builder.append(tag("id", valueOrEmpty(selectedZone.getZoneId())));
            builder.append(tag("city", valueOrEmpty(selectedZone.getCity())));
            builder.append("</zone>");
        }
        builder.append("</posting>");
        builder.append("</checkAvailability>");
        return builder.toString();
    }

    private String buildConfirmationRequestXml(String requestId) {
        return "<confirm xmlns=\"" + NAMESPACE + "\">" + tag("requestId", valueOrEmpty(requestId)) + "</confirm>";
    }

    private String buildCancelRequestXml(String requestId) {
        return "<cancel xmlns=\"" + NAMESPACE + "\">" + tag("requestId", valueOrEmpty(requestId)) + "</cancel>";
    }

    private String createDemoRequestId() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    }

    private String generateInvoiceNumber() {
        long invoice = ThreadLocalRandom.current().nextLong(1_000_000_000L, 10_000_000_000L);
        return Long.toString(invoice);
    }

    private String valueOrEmpty(String value) {
        return value == null ? "" : escapeXml(value);
    }

    private String tag(String name, String value) {
        return "<" + name + ">" + value + "</" + name + ">";
    }

    private String escapeXml(String value) {
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    private Document parse(String xml) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            return factory.newDocumentBuilder().parse(new InputSource(new StringReader(xml)));
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to parse posting SOAP response", exception);
        }
    }

    private String findText(Document document, String localName) {
        NodeList nodes = document.getElementsByTagNameNS("*", localName);
        if (nodes.getLength() == 0 || nodes.item(0) == null) {
            return null;
        }
        String text = nodes.item(0).getTextContent();
        return StringUtils.hasText(text) ? text.trim() : null;
    }
}
