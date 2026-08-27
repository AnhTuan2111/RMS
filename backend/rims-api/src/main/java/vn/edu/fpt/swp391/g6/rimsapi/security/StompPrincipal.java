package vn.edu.fpt.swp391.g6.rimsapi.security;

import java.security.Principal;

public class StompPrincipal implements Principal
{

    private final UserPrincipal userPrincipal;

    public StompPrincipal(UserPrincipal userPrincipal)
    {
        this.userPrincipal = userPrincipal;
    }

    @Override
    public String getName()
    {
        return String.valueOf(userPrincipal.getId());
    }

}
