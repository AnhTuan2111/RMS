package vn.edu.fpt.swp391.g6.rimsapi.dto.response.payment;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class VNPayResponse
{
    private String paymentUrl;
    private String message;
    private boolean success;
}
