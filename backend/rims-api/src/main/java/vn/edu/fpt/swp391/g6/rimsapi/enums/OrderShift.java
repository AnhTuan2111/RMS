package vn.edu.fpt.swp391.g6.rimsapi.enums;

import java.time.LocalTime;

import lombok.Getter;

@Getter
public enum OrderShift
{
    MORNING(
            "MORNING",
            "Ca sáng",
            LocalTime.of(8, 0),
            LocalTime.of(10, 59),
            "08:00",
            "10:59"), NOON(
                    "NOON",
                    "Ca trưa",
                    LocalTime.of(11, 0),
                    LocalTime.of(13, 59),
                    "11:00",
                    "13:59"), AFTERNOON(
                            "AFTERNOON",
                            "Ca chiều",
                            LocalTime.of(14, 0),
                            LocalTime.of(16, 59),
                            "14:00",
                            "16:59"), EVENING(
                                    "EVENING",
                                    "Ca tối",
                                    LocalTime.of(17, 0),
                                    LocalTime.of(22, 0),
                                    "17:00",
                                    "22:00");

    private final String shiftName;

    private final String displayName;

    private final LocalTime startInclusive;

    private final LocalTime endExclusive;

    private final String startTime;

    private final String endTime;

    OrderShift(
            String shiftName,
            String displayName,
            LocalTime startInclusive,
            LocalTime endExclusive,
            String startTime,
            String endTime)
    {
        this.shiftName = shiftName;
        this.displayName = displayName;
        this.startInclusive = startInclusive;
        this.endExclusive = endExclusive;
        this.startTime = startTime;
        this.endTime = endTime;
    }

    public boolean contains(LocalTime time)
    {
        return !time.isBefore(startInclusive) && time.isBefore(endExclusive);
    }
}
