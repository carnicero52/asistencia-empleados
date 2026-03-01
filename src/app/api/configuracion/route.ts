import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Obtener configuración
export async function GET() {
  try {
    let config = await db.configuracion.findUnique({
      where: { id: 'default' }
    });

    if (!config) {
      config = await db.configuracion.create({
        data: { id: 'default' }
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 });
  }
}

// PUT - Actualizar configuración
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();

    const config = await db.configuracion.upsert({
      where: { id: 'default' },
      update: {
        nombreEmpresa: data.nombreEmpresa,
        logo: data.logo || null,
        direccion: data.direccion || null,
        telefono: data.telefono || null,
        email: data.email || null,
        emailDueno: data.emailDueno || null,
        colorPrimario: data.colorPrimario,
        colorSecundario: data.colorSecundario,
        telegramToken: data.telegramToken || null,
        telegramChatIdDueno: data.telegramChatIdDueno || null,
        horaEntradaDiurno: data.horaEntradaDiurno,
        horaSalidaDiurno: data.horaSalidaDiurno,
        horaEntradaNocturno: data.horaEntradaNocturno,
        horaSalidaNocturno: data.horaSalidaNocturno,
        toleranciaMinutos: data.toleranciaMinutos,
        enviarReporteDiario: data.enviarReporteDiario,
        horaReporteDiario: data.horaReporteDiario,
        notificarEntradaJefe: data.notificarEntradaJefe ?? true,
        notificarResumenDiario: data.notificarResumenDiario ?? true
      },
      create: {
        id: 'default',
        nombreEmpresa: data.nombreEmpresa || 'Mi Empresa',
        logo: data.logo || null,
        direccion: data.direccion || null,
        telefono: data.telefono || null,
        email: data.email || null,
        emailDueno: data.emailDueno || null,
        colorPrimario: data.colorPrimario || '#059669',
        colorSecundario: data.colorSecundario || '#047857',
        telegramToken: data.telegramToken || null,
        telegramChatIdDueno: data.telegramChatIdDueno || null,
        horaEntradaDiurno: data.horaEntradaDiurno || '08:00',
        horaSalidaDiurno: data.horaSalidaDiurno || '17:00',
        horaEntradaNocturno: data.horaEntradaNocturno || '18:00',
        horaSalidaNocturno: data.horaSalidaNocturno || '06:00',
        toleranciaMinutos: data.toleranciaMinutos || 15,
        enviarReporteDiario: data.enviarReporteDiario ?? true,
        horaReporteDiario: data.horaReporteDiario || '18:00',
        notificarEntradaJefe: data.notificarEntradaJefe ?? true,
        notificarResumenDiario: data.notificarResumenDiario ?? true
      }
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error('Error al actualizar configuración:', error);
    return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 });
  }
}
