import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TicketService, TicketListItem, TicketRow } from './ticket.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto, ReplyTicketDto } from './dto/update-ticket.dto';

@Controller('tickets')
@ApiTags('ticket')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TicketController {
  constructor(private readonly svc: TicketService) {}

  /** 任意登录用户：创建工单（默认本人） */
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a support ticket' })
  async create(@CurrentUser() user: AuthUser, @Body() body: CreateTicketDto): Promise<{ ok: true; ticket: TicketRow }> {
    const t = this.svc.create(user.sub, body);
    return { ok: true, ticket: t as TicketRow };
  }

  /** 我的工单 */
  @Get('mine')
  @ApiOperation({ summary: 'List my tickets (customer view)' })
  async mine(@CurrentUser() user: AuthUser, @Query('status') status?: string): Promise<{ ok: true; items: TicketListItem[] }> {
    return { ok: true, items: this.svc.listForUser(user.sub, status) };
  }

  /** 单工单详情 */
  @Get(':id')
  @ApiOperation({ summary: 'Get ticket detail (owner or admin)' })
  async detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const t = this.svc.getDetail(id, user.sub, user.role);
    return { ok: true, ticket: t };
  }

  /** 用户回复 */
  @Post(':id/reply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reply to a ticket' })
  async reply(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: ReplyTicketDto) {
    const m = this.svc.reply(id, user.sub, user.role, body.body);
    return { ok: true, message: m };
  }

  /** 客服/Admin：修改工单 */
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @Roles('admin')
  @ApiOperation({ summary: 'Update ticket status (admin only)' })
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: UpdateTicketDto): Promise<{ ok: true; ticket: TicketRow }> {
    const t = this.svc.update(id, body, user.sub);
    return { ok: true, ticket: t };
  }
}