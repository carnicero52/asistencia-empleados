import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Función para enviar mensaje de Telegram
async function enviarTelegram(token: string, chatId: string, mensaje: string) {
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: mensaje,
        parse_mode: 'HTML'
      })
    });
  } catch (error) {
    console.error('Error enviando Telegram:', error);
  }
}

// Función para enviar email con Resend
async function enviarEmailResumen(email: string, nombreEmpresa: string, resumen: {
  total: number;
  presentes: number;
  ausentes: number;
  tardanzas: number;
  detalles: Array<{ nombre: string; cargo: string; turno: string; entrada: string | null; salida: string | null; estado: string }>;
}) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return;

  const fechaHoy = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">📊 Resumen Diario</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">${nombreEmpresa}</p>
        <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">${fechaHoy}</p>
      </div>

      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
        <div style="display: flex; justify-content: space-around; margin-bottom: 30px;">
          <div style="text-align: center; padding: 15px; background: white; border-radius: 8px; min-width: 100px;">
            <p style="font-size: 28px; font-weight: bold; color: #1f2937; margin: 0;">${resumen.total}</p>
            <p style="color: #6b7280; font-size: 12px; margin: 5px 0 0 0;">Total</p>
          </div>
          <div style="text-align: center; padding: 15px; background: white; border-radius: 8px; min-width: 100px;">
            <p style="font-size: 28px; font-weight: bold; color: #059669; margin: 0;">${resumen.presentes}</p>
            <p style="color: #6b7280; font-size: 12px; margin: 5px 0 0 0;">Presentes</p>
          </div>
          <div style="text-align: center; padding: 15px; background: white; border-radius: 8px; min-width: 100px;">
            <p style="font-size: 28px; font-weight: bold; color: #dc2626; margin: 0;">${resumen.ausentes}</p>
            <p style="color: #6b7280; font-size: 12px; margin: 5px 0 0 0;">Ausentes</p>
          </div>
          <div style="text-align: center; padding: 15px; background: white; border-radius: 8px; min-width: 100px;">
            <p style="font-size: 28px; font-weight: bold; color: #f59e0b; margin: 0;">${resumen.tardanzas}</p>
            <p style="color: #6b7280; font-size: 12px; margin: 5px 0 0 0;">Tardanzas</p>
          </div>
        </div>

        <h3 style="color: #1f2937; margin-bottom: 15px;">Detalle por Empleado</h3>
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 12px; text-align: left; font-size: 12px; color: #6b7280;">Empleado</th>
              <th style="padding: 12px; text-align: center; font-size: 12px; color: #6b7280;">Entrada</th>
              <th style="padding: 12px; text-align: center; font-size: 12px; color: #6b7280;">Salida</th>
              <th style="padding: 12px; text-align: center; font-size: 12px; color: #6b7280;">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${resumen.detalles.map(d => `
              <tr style="border-top: 1px solid #e5e7eb;">
                <td style="padding: 12px;">
                  <p style="margin: 0; font-weight: 500; color: #1f2937;">${d.nombre}</p>
                  <p style="margin: 2px 0 0 0; font-size: 12px; color: #6b7280;">${d.cargo}</p>
                </td>
                <td style="padding: 12px; text-align: center; color: ${d.entrada ? '#059669' : '#dc2626'};">${d.entrada || '—'}</td>
                <td style="padding: 12px; text-align: center; color: ${d.salida ? '#dc2626' : '#6b7280'};">${d.salida || '—'}</td>
                <td style="padding: 12px; text-align: center;">
                  <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; background: ${d.estado === 'Presente' ? '#dcfce7' : d.estado === 'Tardanza' ? '#fef3c7' : '#fee2e2'}; color: ${d.estado === 'Presente' ? '#166534' : d.estado === 'Tardanza' ? '#92400e' : '#991b1b'};">
                    ${d.estado}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 30px;">
          Este es un reporte automático del Sistema de Control de Asistencia
        </p>
      </div>
    </div>
  `;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${nombreEmpresa} <onboarding@resend.dev>`,
      to: email,
      subject: `📊 Resumen Diario de Asistencia - ${nombreEmpresa}`,
      html
    })
  });
}

// GET - Para verificar el cron manualmente
export async function GET(request: NextRequest) {
  return POST(request);
}

// POST - Ejecutar resumen diario
export async function POST(request: NextRequest) {
  try {
    const config = await db.configuracion.findUnique({
      where: { id: 'default' }
    });

    if (!config?.notificarResumenDiario) {
      return NextResponse.json({ mensaje: 'Resumen diario deshabilitado' });
    }

    // Obtener fecha de hoy
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const hoyFin = new Date();
    hoyFin.setHours(23, 59, 59, 999);

    // Obtener todos los empleados activos
    const empleados = await db.empleado.findMany({
      where: { estado: 'activo' },
      orderBy: [{ turno: 'asc' }, { nombre: 'asc' }]
    });

    // Obtener asistencias de hoy
    const asistencias = await db.asistencia.findMany({
      where: {
        fecha: { gte: hoy, lte: hoyFin }
      },
      include: { empleado: true }
    });

    // Procesar datos
    const empleadosConAsistencia = new Map<string, { entrada: string | null; salida: string | null; estado: string }>();

    asistencias.forEach(a => {
      const existing = empleadosConAsistencia.get(a.empleadoId) || { entrada: null, salida: null, estado: 'Ausente' };

      if (a.tipo === 'entrada') {
        existing.entrada = a.hora;
        existing.estado = a.estado === 'tardanza' ? 'Tardanza' : 'Presente';
      } else {
        existing.salida = a.hora;
      }

      empleadosConAsistencia.set(a.empleadoId, existing);
    });

    // Calcular estadísticas
    let presentes = 0;
    let ausentes = 0;
    let tardanzas = 0;
    const detalles: Array<{ nombre: string; cargo: string; turno: string; entrada: string | null; salida: string | null; estado: string }> = [];

    empleados.forEach(emp => {
      const asistencia = empleadosConAsistencia.get(emp.id);

      if (asistencia) {
        detalles.push({
          nombre: `${emp.nombre} ${emp.apellido}`,
          cargo: emp.cargo,
          turno: emp.turno,
          entrada: asistencia.entrada,
          salida: asistencia.salida,
          estado: asistencia.estado
        });

        if (asistencia.estado === 'Presente') presentes++;
        else if (asistencia.estado === 'Tardanza') { tardanzas++; presentes++; }
      } else {
        detalles.push({
          nombre: `${emp.nombre} ${emp.apellido}`,
          cargo: emp.cargo,
          turno: emp.turno,
          entrada: null,
          salida: null,
          estado: 'Ausente'
        });
        ausentes++;
      }
    });

    const resumen = {
      total: empleados.length,
      presentes,
      ausentes,
      tardanzas,
      detalles
    };

    const fechaStr = hoy.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

    // Enviar por Telegram
    if (config.telegramToken && config.telegramChatIdDueno) {
      const mensajeTelegram = `
📊 <b>RESUMEN DIARIO</b>
📅 ${fechaStr}

👤 <b>Total:</b> ${resumen.total}
✅ <b>Presentes:</b> ${resumen.presentes}
❌ <b>Ausentes:</b> ${resumen.ausentes}
⚠️ <b>Tardanzas:</b> ${resumen.tardanzas}

${tardanzas > 0 ? '⚠️ Hay empleados con tardanza hoy' : '✅ Todos puntuales'}
      `;
      await enviarTelegram(config.telegramToken, config.telegramChatIdDueno, mensajeTelegram);
    }

    // Enviar por Email
    if (config.emailDueno) {
      await enviarEmailResumen(config.emailDueno, config.nombreEmpresa, resumen);
    }

    // Guardar registro del reporte
    await db.reporteDiario.create({
      data: {
        fecha: hoy,
        totalEmpleados: resumen.total,
        presentes: resumen.presentes,
        ausentes: resumen.ausentes,
        tardanzas: resumen.tardanzas,
        enviado: true
      }
    });

    return NextResponse.json({
      success: true,
      resumen,
      enviado: {
        telegram: !!(config.telegramToken && config.telegramChatIdDueno),
        email: !!config.emailDueno
      }
    });

  } catch (error) {
    console.error('Error en resumen diario:', error);
    return NextResponse.json({ error: 'Error al generar resumen' }, { status: 500 });
  }
}
