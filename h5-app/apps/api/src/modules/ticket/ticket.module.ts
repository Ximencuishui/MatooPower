import { Module } from '@nestjs/common';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';
import { SlaCronService } from './cron/sla-cron.service';

@Module({
  controllers: [TicketController],
  providers: [TicketService, SlaCronService],
  exports: [TicketService],
})
export class TicketModule {}