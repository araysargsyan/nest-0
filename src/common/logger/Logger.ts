import { Logger as NextLogger, LoggerService } from '@nestjs/common';
import chalk from 'chalk';

export class Logger extends NextLogger implements LoggerService {
  info(message: any, context?: string) {
    const coloredContext = chalk.yellowBright(`[${context || this.context}]`);
    console.log(`${chalk.blueBright('INFO')} ${coloredContext}`, message);
  }

  infoMessage(message: string, context?: string) {
    const coloredMessage = chalk.blueBright(message);
    this.info(coloredMessage)
  }
}
