import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DaySummary } from "@/lib/attendance";
import { WEEKDAY_SHORT, formatMinutes, formatTime, isoToDisplay, weekdayOfISO } from "@/lib/time-utils";
import { cn } from "@/lib/utils";

export function DaysTable({
  days,
  onRowClick,
}: {
  days: DaySummary[];
  onRowClick?: (day: DaySummary) => void;
}) {
  let running = 0;

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="min-w-[130px]">Data</TableHead>
            <TableHead>Entrada</TableHead>
            <TableHead>Int. início</TableHead>
            <TableHead>Int. retorno</TableHead>
            <TableHead>Saída</TableHead>
            <TableHead>Previsto</TableHead>
            <TableHead>Trabalhado</TableHead>
            <TableHead>Saldo</TableHead>
            <TableHead>Acumulado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {days.map((d) => {
            running += d.balanceMinutes;
            const hasData = Boolean(d.record?.clock_in);
            return (
              <TableRow
                key={d.date}
                onClick={() => onRowClick?.(d)}
                className={cn(
                  onRowClick && "cursor-pointer",
                  !hasData && d.isWeekend && "opacity-60",
                )}
              >
                <TableCell className="whitespace-nowrap font-medium">
                  <div className="flex items-center gap-2">
                    <span>{isoToDisplay(d.date)}</span>
                    <span className="text-xs text-muted-foreground">
                      {WEEKDAY_SHORT[weekdayOfISO(d.date)]}
                    </span>
                    {d.isHoliday && (
                      <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
                        Feriado
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-clock">{formatTime(d.record?.clock_in)}</TableCell>
                <TableCell className="text-clock">{formatTime(d.record?.lunch_start)}</TableCell>
                <TableCell className="text-clock">{formatTime(d.record?.lunch_end)}</TableCell>
                <TableCell className="text-clock">{formatTime(d.record?.clock_out)}</TableCell>
                <TableCell className="text-clock text-muted-foreground">
                  {formatMinutes(d.scheduledMinutes)}
                </TableCell>
                <TableCell className="text-clock">{formatMinutes(d.workedMinutes)}</TableCell>
                <TableCell
                  className={cn(
                    "text-clock font-semibold",
                    d.balanceMinutes > 0 && "text-success",
                    d.balanceMinutes < 0 && "text-destructive",
                  )}
                >
                  {formatMinutes(d.balanceMinutes, true)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-clock",
                    running > 0 && "text-success",
                    running < 0 && "text-destructive",
                  )}
                >
                  {formatMinutes(running, true)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
