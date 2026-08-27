package vn.edu.fpt.swp391.g6.rimsapi.repository;

import java.time.LocalDateTime;

import org.springframework.data.jpa.repository.JpaRepository;

import vn.edu.fpt.swp391.g6.rimsapi.entity.RevokedToken;

public interface RevokedTokenRepository extends JpaRepository<RevokedToken, String>
{
    boolean existsByJti(String jti);

    void deleteAllByExpiresAtBefore(LocalDateTime cutoff);
}
