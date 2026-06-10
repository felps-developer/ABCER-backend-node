import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  async enviarLinkTrocaSenha(destinatario: string, token: string): Promise<void> {
    const siteUrl = process.env.SITE_URL ?? 'http://localhost:4200';
    const link = `${siteUrl}/trocar-senha?token=${token}`;

    const html = `
      <h3>Sistema ABCER - Solicitação de Troca de Senha</h3>
      <p><b>Para trocar a senha, clique no link abaixo. Ele expira em uma hora.</b></p>
      <p><a href="${link}">Trocar a Senha</a></p>
      <p>Caso não tenha solicitado a troca, favor, desconsiderar este email.</p>
    `;

    if (!process.env.EMAIL_HOST) {
      console.log(`[EmailService] SMTP não configurado. Link de reset para ${destinatario}: ${link}`);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PASS ?? 587),
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: destinatario,
      subject: 'Sistema ABCER - Solicitação de Troca de Senha',
      html,
    });
  }
}
