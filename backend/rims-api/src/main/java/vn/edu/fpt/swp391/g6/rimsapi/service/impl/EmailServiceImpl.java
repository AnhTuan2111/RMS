package vn.edu.fpt.swp391.g6.rimsapi.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import vn.edu.fpt.swp391.g6.rimsapi.service.EmailService;

@Service
@RequiredArgsConstructor
public class EmailServiceImpl implements EmailService
{

    private final JavaMailSender mailSender;

    @Override
    public void sendOtp(String toEmail, String otp)
    {
        try
        {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(toEmail);
            message.setSubject("[RIMS] Mã OTP đặt lại mật khẩu");
            message.setText(
                    "Xin chào,\n\n" +
                            "Mã OTP của bạn để đặt lại mật khẩu là: " + otp + "\n\n" +
                            "Mã có hiệu lực trong 5 phút.\n\n" +
                            "Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.\n\n" +
                            "Trân trọng,\nRIMS System");
            mailSender.send(message);

        } catch (MailAuthenticationException e)
        {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Không thể gửi email: Cấu hình SMTP chưa đúng. Vui lòng kiểm tra username/password trong application.yaml");

        } catch (MailSendException e)
        {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Không thể gửi email đến " + toEmail + ". Vui lòng kiểm tra lại địa chỉ email.");

        } catch (Exception e)
        {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Lỗi gửi email: " + e.getMessage());
        }
    }
}
