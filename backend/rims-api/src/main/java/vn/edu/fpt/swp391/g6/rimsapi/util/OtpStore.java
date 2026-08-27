package vn.edu.fpt.swp391.g6.rimsapi.util;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

@Component
public class OtpStore
{

    private static final int OTP_EXPIRE_MINUTES = 5;
    private final Map<String, OtpEntry> store = new ConcurrentHashMap<>();
    public void save(String email, String otp)
    {
        store.put(email, new OtpEntry(otp, LocalDateTime.now().plusMinutes(OTP_EXPIRE_MINUTES)));
    }
    public boolean verify(String email, String otp)
    {
        OtpEntry entry = store.get(email);
        if (entry == null)
            return false;
        if (LocalDateTime.now().isAfter(entry.expiresAt()))
        {
            store.remove(email);
            return false;
        }
        return entry.otp().equals(otp);
    }
    public void remove(String email)
    {
        store.remove(email);
    }

    private record OtpEntry(String otp, LocalDateTime expiresAt)
    {
    }
}
