package vn.edu.fpt.swp391.g6.rimsapi.exception;

import org.springframework.security.authentication.BadCredentialsException;

public class InvalidTokenException extends BadCredentialsException
{
    public InvalidTokenException(String message)
    {
        super(message);
    }
}
