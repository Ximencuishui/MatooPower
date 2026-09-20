// 全局异常过滤器：把异常统一转为 {statusCode, error, message}
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as { message?: string | string[]; error?: string };
        message = b.message ?? exception.message;
        code = b.error ?? HttpStatus[status] ?? code;
      }
      code = HttpStatus[status] ?? code;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // 错误码精简（演示期友好输出）
    const errorCode = String(code).toUpperCase().replace(/\s+/g, '_');

    if (status >= 500) {
      this.logger.error(
        `[${req.method} ${req.url}] ${status} ${errorCode}: ${JSON.stringify(message)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `[${req.method} ${req.url}] ${status} ${errorCode}: ${JSON.stringify(message)}`,
      );
    }

    res.status(status).json({
      statusCode: status,
      error: errorCode,
      message,
    });
  }
}