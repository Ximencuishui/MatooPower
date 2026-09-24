// v1.4 T-2d X2 · Public inquiry ingestion endpoint
//
// POST /api/public/inquiry-from-web
//
// 用途:接收 website/api/routes/inquiries.js 在写完 inquiries.log 后,异步转发过来的询盘。
// - 公开端点:跳过 JWT 鉴权(@Public)
// - 限流:60 req/min/IP(防止滥用,但允许合法批量提交)
// - 不依赖系统用户是否未存在:Ticket.userId FK → system-web-inquiry(由 0006 migration 保证)
// - SLA 升级 sweep 由 ticket.service 内部触发,与登录用户路径一致

import { Body, Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt-auth.guard';
import { TicketService } from '../ticket/ticket.service';
import { InquiryFromWebDto } from './dto/inquiry-from-web.dto';

const SYSTEM_WEB_INQUIRY_USER = 'system-web-inquiry';

@Public()
@Controller('public/inquiry-from-web')
@ApiTags('public')
export class PublicInquiryController {
  private readonly logger = new Logger(PublicInquiryController.name);

  constructor(private readonly tickets: TicketService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  // P0-5:公开端点单独收紧到 60/min/IP(防滥用,高于全局 100/min/IP,留余量给合法前端表单提交)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Ingest a public inquiry submitted from the website' })
  async ingest(@Body() body: InquiryFromWebDto): Promise<{
    ok: true;
    ticketId: string;
    sourceInquiryId?: string;
  }> {
    // 1) 兜底校验:至少一个 contact(website 端已校验,这里再加一次防 schema 漂移)
    const hasContact = !!(body.email?.trim() || body.phone?.trim());
    if (!hasContact) {
      this.logger.warn(`[inquiry-from-web] rejected: no contact (inquiryId=${body.inquiryId ?? '-'})`);
      return { ok: true, ticketId: 'rejected-no-contact' }; // 仍 200 让 website 不感知,只在内部记录
    }

    // 2) 构造 subject + description
    const who =
      body.name?.trim() ||
      body.company?.trim() ||
      body.email?.trim() ||
      body.phone?.trim() ||
      'anonymous';
    const subject =
      `[${body._form}] website inquiry from ${who}`.slice(0, 200);

    const lines: string[] = [];
    if (body.message?.trim()) lines.push(body.message.trim());
    if (body.company?.trim() && body.company.trim() !== who) lines.push(`Company: ${body.company.trim()}`);
    if (body.email?.trim()) lines.push(`Email: ${body.email.trim()}`);
    if (body.phone?.trim()) lines.push(`Phone: ${body.phone.trim()}`);
    if (body._lang) lines.push(`Lang: ${body._lang}`);
    if (body._source) lines.push(`Source: ${body._source}`);
    if (body.inquiryId) lines.push(`Website inquiryId: ${body.inquiryId}`);
    lines.push('--');
    lines.push('Submitted via website/api/routes/inquiries.js (forwarded to h5-app public system).');
    const description = lines.join('\n').slice(0, 4096);

    // 3) 写入 Ticket(type='inquiry', severity='normal', status='open', source='web')
    const ticket = this.tickets.create(SYSTEM_WEB_INQUIRY_USER, {
      type: 'inquiry',
      severity: 'normal',
      subject,
      description,
      contactPhone: body.phone?.trim() || undefined,
    }, 'web');

    this.logger.log(
      `[inquiry-from-web] created ticket=${ticket.id} form=${body._form} inquiryId=${body.inquiryId ?? '-'}`,
    );

    return {
      ok: true,
      ticketId: ticket.id,
      sourceInquiryId: body.inquiryId,
    };
  }
}