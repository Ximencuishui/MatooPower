import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ActivateWarrantyDto } from './dto/activate-warranty.dto';
import { WarrantyService } from './warranty.service';

@Controller('warranty')
@ApiTags('warranty')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
export class WarrantyController {
  constructor(private readonly svc: WarrantyService) {}

  /** 激活保修（策略 A：有发票按发票日；策略 C 兜底：MFG + 60 天） */
  @Post('activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate warranty (Policy A or C)' })
  async activate(@CurrentUser() user: AuthUser, @Body() body: ActivateWarrantyDto) {
    const result = await this.svc.activate(user.sub, body);
    return {
      ok: true,
      policy: result.policy,
      startAt: result.startAt.toISOString(),
      endAtWhole: result.endAtWhole.toISOString(),
      endAtCell: result.endAtCell?.toISOString() ?? null,
      endAtBms: result.endAtBms?.toISOString() ?? null,
      endAtParts: result.endAtParts?.toISOString() ?? null,
      warranty: result.warranty,
    };
  }

  @Get('mine')
  @ApiOperation({ summary: 'List my warranties' })
  async listMine(@CurrentUser() user: AuthUser) {
    const rows = await this.svc.listMine(user.sub);
    return { ok: true, items: rows };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get warranty by id (owner or admin only)' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const w = await this.svc.findOne(id, user.role === 'admin' ? undefined : user.sub);
    return { ok: true, ...w };
  }
}