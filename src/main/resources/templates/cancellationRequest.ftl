<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:pos="http://disim.univaq.it/services">
   <soapenv:Header/>
   <soapenv:Body>
      <pos:CancellationRequest>
         <pos:requestId>${requestId}</pos:requestId>
      </pos:CancellationRequest>
   </soapenv:Body>
</soapenv:Envelope>