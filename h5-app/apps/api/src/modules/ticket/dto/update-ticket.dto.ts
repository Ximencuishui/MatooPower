import { IsEnum, IsOptional, IsString } from 'class-validator';

export type TicketStatus = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';

export class UpdateTicketDto {
  @IsEnum(['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'])
  status!: TicketStatus;

  @IsOptional()
  @IsString()
  resolution?: string;

  @IsOptional()
  @IsString()
  assigneeUserId?: string;
}

export class ReplyTicketDto {
  @IsString()
  body!: string;
}