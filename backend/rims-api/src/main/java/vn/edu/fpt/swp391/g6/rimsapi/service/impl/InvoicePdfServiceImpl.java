package vn.edu.fpt.swp391.g6.rimsapi.service.impl;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.List;

import jakarta.persistence.EntityNotFoundException;
import jakarta.transaction.Transactional;

import com.lowagie.text.*;
import com.lowagie.text.pdf.BaseFont;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import vn.edu.fpt.swp391.g6.rimsapi.entity.Invoice;
import vn.edu.fpt.swp391.g6.rimsapi.entity.Order;
import vn.edu.fpt.swp391.g6.rimsapi.entity.OrderItem;
import vn.edu.fpt.swp391.g6.rimsapi.entity.Payment;
import vn.edu.fpt.swp391.g6.rimsapi.enums.OrderItemStatus;
import vn.edu.fpt.swp391.g6.rimsapi.enums.PaymentMethod;
import vn.edu.fpt.swp391.g6.rimsapi.repository.InvoiceRepository;
import vn.edu.fpt.swp391.g6.rimsapi.service.InvoicePdfService;

@Service
@RequiredArgsConstructor
public class InvoicePdfServiceImpl implements InvoicePdfService
{

    private final InvoiceRepository invoiceRepository;

    @Override
    @Transactional
    public byte[] generateInvoicePdf(Long invoiceId)
    {
        // Load fresh bên trong transaction hiện tại -> session còn sống
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new EntityNotFoundException("Không tìm thấy hóa đơn: " + invoiceId));

        Document document = new Document(PageSize.A6, 10, 10, 15, 15);
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        try
        {
            PdfWriter.getInstance(document, out);
            document.open();

            // front tiếng việt
            ClassPathResource fontResource = new ClassPathResource("fonts/times.ttf");
            String fontPath = fontResource.getFile().getAbsolutePath();
            BaseFont bf = BaseFont.createFont(fontPath, BaseFont.IDENTITY_H, BaseFont.EMBEDDED);

            Font fontTitle = new Font(bf, 13, Font.BOLD);
            Font fontHeader = new Font(bf, 11, Font.BOLD);
            Font fontBold = new Font(bf, 9, Font.BOLD);
            Font fontNormal = new Font(bf, 9, Font.NORMAL);
            Font fontItalic = new Font(bf, 9, Font.ITALIC);

            Paragraph restaurantName = new Paragraph("NHÀ HÀNG RIMS", fontTitle);
            restaurantName.setAlignment(Element.ALIGN_CENTER);
            document.add(restaurantName);

            Paragraph address = new Paragraph(
                    "Đại học FPT, Khu Công Nghệ Cao Hòa Lạc, Thạch Thất, Hà Nội\nĐT: 0987.654.321 - 0123.456.789\n",
                    fontNormal);
            address.setAlignment(Element.ALIGN_CENTER);
            document.add(address);

            Paragraph receiptTitle = new Paragraph("HÓA ĐƠN THANH TOÁN", fontHeader);
            receiptTitle.setAlignment(Element.ALIGN_CENTER);
            receiptTitle.setSpacingBefore(5);
            receiptTitle.setSpacingAfter(5);
            document.add(receiptTitle);

            // Thông tin meta (Số HĐ, Ngày, Bàn, Thu ngân)
            Order order = invoice.getOrder();
            String tableName = (order.getTable() != null) ? order.getTable().getTableNumber() : "Mang về";

            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

            PdfPTable infoTable = new PdfPTable(2);
            infoTable.setWidthPercentage(100);
            infoTable.setWidths(new float[]{50, 50});

            infoTable.addCell(createCell("Số HĐ: " + String.format("%04d", invoice.getId()), fontNormal,
                    Element.ALIGN_LEFT, false));
            infoTable.addCell(createCell("Bàn: " + tableName, fontBold, Element.ALIGN_RIGHT, false));
            infoTable.addCell(createCell("Ngày in: " + invoice.getInvoiceDate().format(formatter), fontNormal,
                    Element.ALIGN_LEFT, false));
            infoTable.addCell(createCell("", fontNormal, Element.ALIGN_RIGHT, false));

            document.add(infoTable);

            Paragraph lineSeparator = new Paragraph(
                    "- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -", fontNormal);
            lineSeparator.setAlignment(Element.ALIGN_CENTER);
            document.add(lineSeparator);

            // Bảng danh sách món ăn (4 cột: Tên, SL, Đ.Giá, T.Tiền)
            PdfPTable table = new PdfPTable(4);
            table.setWidthPercentage(100);
            table.setWidths(new float[]{40, 12, 23, 25});
            table.setSpacingBefore(5);

            table.addCell(createCell("TÊN HÀNG", fontBold, Element.ALIGN_LEFT, false));
            table.addCell(createCell("SL", fontBold, Element.ALIGN_CENTER, false));
            table.addCell(createCell("Đ.GIÁ", fontBold, Element.ALIGN_RIGHT, false));
            table.addCell(createCell("T.TIỀN", fontBold, Element.ALIGN_RIGHT, false));

            List<OrderItem> completedItems = order.getOrderItems().stream()
                    .filter(oi -> oi.getStatus() == OrderItemStatus.COMPLETED)
                    .toList();

            int totalItems = 0;
            BigDecimal totalBeforeVat = BigDecimal.ZERO;
            for (OrderItem item : completedItems)
            {
                String dishName = item.getDishNameSnapshot();
                totalItems += item.getQuantity();
                totalBeforeVat = totalBeforeVat.add(item.getSubTotal());

                table.addCell(createCell(dishName, fontNormal, Element.ALIGN_LEFT, false));
                table.addCell(createCell(String.valueOf(item.getQuantity()), fontNormal, Element.ALIGN_CENTER, false));
                table.addCell(createCell(String.format("%,.0f", item.getUnitPrice()), fontNormal, Element.ALIGN_RIGHT,
                        false));
                table.addCell(
                        createCell(String.format("%,.0f", item.getSubTotal()), fontNormal, Element.ALIGN_RIGHT, false));
            }
            document.add(table);
            document.add(lineSeparator);

            //Phần Tổng kết tài chính — ĐÃ SỬA: tự tính từ các món COMPLETED, không dùng order.getTotalAmount() nữa
            BigDecimal vatAmount = totalBeforeVat.multiply(new BigDecimal("0.10"));
            BigDecimal finalAmount = invoice.getFinalAmount();

            PaymentMethod method = PaymentMethod.CASH;
            BigDecimal amountPaid = finalAmount;
            List<Payment> payments = invoice.getPayments();
            if (payments != null && !payments.isEmpty())
            {
                Payment firstPayment = payments.get(0); // Lấy giao dịch đầu tiên
                method = firstPayment.getPaymentMethod();
                if (firstPayment.getAmount() != null)
                {
                    amountPaid = firstPayment.getAmount();
                }
            }

            PdfPTable totalTable = new PdfPTable(2);
            totalTable.setWidthPercentage(100);
            totalTable.setWidths(new float[]{60, 40});
            totalTable.setSpacingBefore(5);

            // Dòng Cộng tiền món
            totalTable.addCell(
                    createCell("Cộng tiền hàng (" + totalItems + " món):", fontNormal, Element.ALIGN_LEFT, false));
            totalTable.addCell(
                    createCell(String.format("%,.0f đ", totalBeforeVat), fontNormal, Element.ALIGN_RIGHT, false));

            // Dòng VAT
            totalTable.addCell(createCell("VAT (10%):", fontNormal, Element.ALIGN_LEFT, false));
            totalTable.addCell(createCell(String.format("%,.0f đ", vatAmount), fontNormal, Element.ALIGN_RIGHT, false));

            if (invoice.getCustomer() != null)
            {
                totalTable.addCell(createCell("Khách hàng:", fontNormal, Element.ALIGN_LEFT, false));
                totalTable.addCell(
                        createCell(invoice.getCustomer().getFullName(), fontNormal, Element.ALIGN_RIGHT, false));

                if (invoice.getPointsUsedOnInvoice() != null && invoice.getPointsUsedOnInvoice() > 0)
                {
                    totalTable.addCell(createCell("Điểm đã dùng:", fontNormal, Element.ALIGN_LEFT, false));
                    totalTable.addCell(
                            createCell("-" + String.format("%,.0f đ", (double) invoice.getPointsUsedOnInvoice() * 1000),
                                    fontNormal, Element.ALIGN_RIGHT, false));
                }

                if (invoice.getPointsEarnedOnInvoice() != null && invoice.getPointsEarnedOnInvoice() > 0)
                {
                    totalTable.addCell(createCell("Điểm tích thêm:", fontItalic, Element.ALIGN_LEFT, false));
                    totalTable.addCell(createCell("+" + invoice.getPointsEarnedOnInvoice() + " điểm", fontItalic,
                            Element.ALIGN_RIGHT, false));
                }
            }

            // Dòng Thành tiền
            totalTable.addCell(createCell("THÀNH TIỀN:", fontHeader, Element.ALIGN_LEFT, false));
            totalTable
                    .addCell(createCell(String.format("%,.0f đ", finalAmount), fontHeader, Element.ALIGN_RIGHT, false));

            // Phương thức thanh toán
            String methodStr = (method == PaymentMethod.CASH) ? "Tiền mặt" : "Chuyển khoản/QR";
            totalTable.addCell(createCell("Hình thức TT:", fontItalic, Element.ALIGN_LEFT, false));
            totalTable.addCell(createCell(methodStr, fontItalic, Element.ALIGN_RIGHT, false));

            // Xử lý riêng cho Tiền mặt (Tiền khách đưa & Tiền thừa)
            if (method == PaymentMethod.CASH)
            {
                totalTable.addCell(createCell("Khách thanh toán:", fontNormal, Element.ALIGN_LEFT, false));
                totalTable.addCell(
                        createCell(String.format("%,.0f đ", amountPaid), fontNormal, Element.ALIGN_RIGHT, false));

                BigDecimal excessAmount = amountPaid.subtract(finalAmount);
                if (excessAmount.compareTo(BigDecimal.ZERO) < 0)
                    excessAmount = BigDecimal.ZERO; // An toàn

                totalTable.addCell(createCell("Tiền thừa trả khách:", fontNormal, Element.ALIGN_LEFT, false));
                totalTable.addCell(
                        createCell(String.format("%,.0f đ", excessAmount), fontNormal, Element.ALIGN_RIGHT, false));
            }

            document.add(totalTable);

            // Footer
            Paragraph footer = new Paragraph("\nCám Ơn Quý Khách - Hẹn Gặp Lại", fontItalic);
            footer.setAlignment(Element.ALIGN_CENTER);
            document.add(footer);

            document.close();
        } catch (Exception e)
        {
            e.printStackTrace();
            throw new RuntimeException("Lỗi khi tạo file PDF: " + e.getMessage());
        }

        return out.toByteArray();
    }

    private PdfPCell createCell(String text, Font font, int alignment, boolean hasBorder)
    {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setHorizontalAlignment(alignment);
        cell.setVerticalAlignment(Element.ALIGN_MIDDLE);
        if (!hasBorder)
            cell.setBorder(PdfPCell.NO_BORDER);
        cell.setPaddingTop(3);
        cell.setPaddingBottom(3);
        return cell;
    }
}
