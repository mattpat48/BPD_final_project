<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:pos="http://disim.univaq.it/services/postingservice">
   <soapenv:Header/>
   <soapenv:Body>
      <pos:availabilityRequest>
         <pos:applicant>
            <pos:name>${userData.prop("name").stringValue()}</pos:name>
            <pos:surname>${userData.prop("surname").stringValue()}</pos:surname>
            <pos:taxCode>${userData.prop("taxCode").stringValue()}</pos:taxCode>
            <pos:address>${userData.prop("address").stringValue()}</pos:address>
            <pos:city>${userData.prop("city").stringValue()}</pos:city>
            <pos:zip>${userData.prop("zipCode").numberValue()?c}</pos:zip>
            <pos:email>${userData.prop("email").stringValue()}</pos:email>
         </pos:applicant>
         <pos:posting>
            <pos:posterFormat>${posterFormat}</pos:posterFormat>
            <#list selectedZonesSpin.elements() as zone>
            <pos:zone>
               <pos:id>${zone.prop("id").numberValue()?c}</pos:id>
               <pos:city>${zone.prop("city").stringValue()}</pos:city>
            </pos:zone>
            </#list>
         </pos:posting>
      </pos:availabilityRequest>
   </soapenv:Body>
</soapenv:Envelope>