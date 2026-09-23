// v1.4 T-2d X2 · Public inquiry module
// 公开询盘接入(无 JWT)。复用 TicketService 写入,继承 SLA 升级 sweep。

import { Module } from '@nestjs/common';
import { TicketModule } from '../ticket/ticket.module';
import { PublicInquiryController } from './public-inquiry.controller';

@Module({
  imports: [TicketModule],
  controllers: [PublicInquiryController],
})
export class PublicInquiryModule {}