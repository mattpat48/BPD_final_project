================= ORDER CONFIRMATION =================
Request ID     : ${requestId}
Username       : ${username}

----------------- Applicant -------------------------
Name           : ${userData.prop("name").stringValue()} ${userData.prop("surname").stringValue()}
Tax code       : ${userData.prop("taxCode").stringValue()}
Address        : ${userData.prop("address").stringValue()}, ${userData.prop("city").stringValue()} ${userData.prop("zipCode").numberValue()?c}
Phone          : ${userData.prop("phone").stringValue()}
Email          : ${userData.prop("email").stringValue()}

----------------- Posting ---------------------------
Poster format  : ${posterFormat}
Strategy used  : ${usedStrategy}
Selected zones :
<#list selectedZonesSpin.elements() as zone>
  - [${zone.prop("id").numberValue()?c}] ${zone.prop("city").stringValue()} / ${zone.prop("name").stringValue()} (EUR ${zone.prop("price").numberValue()?c})
</#list>
Total price    : EUR ${totalPrice?c}

----------------- Billing ---------------------------
Account holder : ${accountHolder}
Invoice number : ${invoiceNumber}
Amount due     : EUR ${amountDue}
=====================================================
