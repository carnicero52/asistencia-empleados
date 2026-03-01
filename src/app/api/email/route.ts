import { NextRequest, NextResponse } from 'next/server';

// Configuración de Resend (servicio de email gratuito)
// Para usar, instalar: npm install resend
// Y configurar RESEND_API_KEY en las variables de entorno

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { email, nombre, codigo, cargo, turno, horaEntrada, horaSalida, codigoQr, nombreEmpresa } = data;

    // Generar URL del QR
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(codigoQr)}`;

    // Usar Resend API (gratuito hasta 3000 emails/mes)
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (!RESEND_API_KEY) {
      // Si no hay API key, simular envío exitoso para desarrollo
      console.log('Email simulado enviado a:', email);
      console.log('Datos:', { nombre, codigo, cargo, qrUrl });

      return NextResponse.json({
        success: true,
        mensaje: 'Email configurado correctamente (modo desarrollo - configure RESEND_API_KEY)'
      });
    }

    // Enviar email con Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${nombreEmpresa} <onboarding@resend.dev>`,
        to: email,
        subject: `Tu Código QR de Acceso - ${nombreEmpresa}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">${nombreEmpresa}</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Sistema de Control de Asistencia</p>
            </div>

            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
              <h2 style="color: #1f2937; margin-top: 0;">Hola ${nombre},</h2>
              <p style="color: #4b5563;">Aquí tienes tu código QR personal para registrar tu asistencia en la empresa.</p>

              <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <img src="${qrUrl}" alt="Código QR" style="width: 200px; height: 200px; margin: 10px auto;" />
                <p style="color: #6b7280; font-size: 14px;">Escanea este código para marcar tu entrada/salida</p>
              </div>

              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #1f2937; margin-top: 0;">Tus Datos</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Código:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-weight: bold; border-bottom: 1px solid #e5e7eb;">${codigo}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Cargo:</td>
                    <td style="padding: 8px 0; color: #1f2937; border-bottom: 1px solid #e5e7eb;">${cargo}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Turno:</td>
                    <td style="padding: 8px 0; color: #1f2937; border-bottom: 1px solid #e5e7eb;">${turno.toUpperCase()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Horario:</td>
                    <td style="padding: 8px 0; color: #1f2937; border-bottom: 1px solid #e5e7eb;">${horaEntrada} - ${horaSalida}</td>
                  </tr>
                </table>
              </div>

              <div style="background: #ecfdf5; border-left: 4px solid #059669; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #065f46;">
                  <strong>Instrucciones:</strong><br>
                  1. Guarda este email para tener acceso a tu QR<br>
                  2. Presenta tu código QR en la entrada de la empresa<br>
                  3. Escanea para registrar tu entrada y salida
                </p>
              </div>

              <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 30px;">
                Este es un email automático del Sistema de Control de Asistencia de ${nombreEmpresa}
              </p>
            </div>
          </div>
        `
      })
    });

    const result = await response.json();

    if (response.ok) {
      return NextResponse.json({
        success: true,
        messageId: result.id,
        mensaje: 'Email enviado correctamente'
      });
    } else {
      console.error('Error enviando email:', result);
      return NextResponse.json({
        error: 'Error al enviar email',
        details: result
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error en API email:', error);
    return NextResponse.json({
      error: 'Error al procesar solicitud de email'
    }, { status: 500 });
  }
}
