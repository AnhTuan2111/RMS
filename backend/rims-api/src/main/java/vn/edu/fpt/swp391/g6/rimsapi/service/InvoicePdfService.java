package vn.edu.fpt.swp391.g6.rimsapi.service;

public interface InvoicePdfService
{
    byte[] generateInvoicePdf(Long invoiceId);
}
