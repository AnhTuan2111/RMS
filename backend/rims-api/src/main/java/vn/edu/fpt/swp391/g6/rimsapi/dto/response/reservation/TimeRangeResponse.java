package vn.edu.fpt.swp391.g6.rimsapi.dto.response.reservation;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TimeRangeResponse
{
    private LocalDateTime start;
    private LocalDateTime end;
}
