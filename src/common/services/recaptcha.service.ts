import { Injectable } from '@nestjs/common';
import { BusinessException } from '../exceptions/business.exception';

@Injectable()
export class RecaptchaService {
  async validar(token: string): Promise<void> {
    if (process.env.RECAPTCHA_BYPASS === 'true') return;

    const secret = process.env.RECAPTCHA_SECRET_KEY ?? '';
    const params = new URLSearchParams({ secret, response: token });

    let success = false;
    try {
      const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        body: params,
      });
      const data = (await res.json()) as { success: boolean };
      success = data.success;
    } catch {
      // network failure → treat as invalid
    }

    if (!success) throw new BusinessException(['Captcha inválido.']);
  }
}
