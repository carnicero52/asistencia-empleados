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

// Función para enviar email de notificación al jefe
async function enviarEmailNotificacionJefe(
  email: string,
  nombreEmpresa: string,
  empleado: { nombre: string; apellido: string; cargo: string; departamento: string | null; turno: string },
  tipo: string,
  hora: string,
  estado: string,
  horasTrabajadas: number | null
) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return;

  const fechaStr = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const tipoEmoji = tipo === 'entrada' ? '🟢' : '🔴';
  const estadoTexto = estado === 'tardanza' ? ' ⚠️ TARDANZA' : '';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
      <div style="background: ${tipo === 'entrada' ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)'}; color: white; padding: 25px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">${tipoEmoji} ${tipo === 'entrada' ? 'ENTRADA' : 'SALIDA'}</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.9;">${nombreEmpresa}</p>
      </div>

      <div style="background: #f9fafb; padding: 25px; border-radius: 0 0 10px 10px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <p style="font-size: 22px; font-weight: bold; color: #1f2937; margin: 0;">${empleado.nombre} ${empleado.apellido}</p>
          <p style="color: #6b7280; margin: 5px 0 0 0;">${empleado.cargo}${empleado.departamento ? ` - ${empleado.departamento}` : ''}</p>
        </div>

        <div style="background: white; padding: 15px; border-radius: 8px; text-align: center;">
          <p style="font-size: 36px; font-weight: bold; color: ${tipo === 'entrada' ? '#059669' : '#dc2626'}; margin: 0;">${hora}</p>
          <p style="color: #6b7280; margin: 5px 0 0 0; font-size: 14px;">${fechaStr}</p>
        </div>

        ${estado === 'tardanza' ? `
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin-top: 15px; border-radius: 4px;">
            <p style="margin: 0; color: #92400e; font-weight: 500;">⚠️ Esta llegada se registró como TARDANZA</p>
          </div>
        ` : ''}

        ${tipo === 'salida' && horasTrabajadas ? `
          <div style="background: #ecfdf5; border-left: 4px solid #059669; padding: 12px; margin-top: 15px; border-radius: 4px;">
            <p style="margin: 0; color: #065f46;">⏱️ Horas trabajadas hoy: <strong>${horasTrabajadas.toFixed(1)} horas</strong></p>
          </div>
        ` : ''}

        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center;">
          <span style="padding: 4px 12px; background: ${empleado.turno === 'diurno' ? '#fef3c7' : '#e0e7ff'}; color: ${empleado.turno === 'diurno' ? '#92400e' : '#3730a3'}; border-radius: 12px; font-size: 12px; font-weight: 500;">
            TURNO ${empleado.turno.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  `;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${nombreEmpresa} <onboarding@resend.dev>`,
        to: email,
        subject: `${tipoEmoji} ${tipo === 'entrada' ? 'Entrada' : 'Salida'} - ${empleado.nombre} ${empleado.apellido}`,
        html
      })
    });
    console.log('Email de notificación enviado a:', email);
  } catch (error) {
    console.error('Error enviando email de notificación:', error);
  }
}

// Función para calcular si es tardanza
function esTardanza(horaActual: string, horaEntrada: string, toleranciaMinutos: number): boolean {
  const [hActual, mActual] = horaActual.split(':').map(Number);
  const [hEntrada, mEntrada] = horaEntrada.split(':').map(Number);

  const minutosActual = hActual * 60 + mActual;
  const minutosEntrada = hEntrada * 60 + mEntrada;

  return minutosActual > minutosEntrada + toleranciaMinutos;
}

// Función para calcular horas trabajadas
function calcularHorasTrabajadas(horaEntrada: string, horaSalida: string): number {
  const [hEnt, mEnt] = horaEntrada.split(':').map(Number);
  const [hSal, mSal] = horaSalida.split(':').map(Number);

  const minutosEntrada = hEnt * 60 + mEnt;
  const minutosSalida = hSal * 60 + mSal;

  return Math.max(0, (minutosSalida - minutosEntrada) / 60);
}

// GET - Listar asistencias
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fecha = searchParams.get('fecha');
    const empleadoId = searchParams.get('empleadoId');
    const turno = searchParams.get('turno');

    const where: Record<string, unknown> = {};
    if (empleadoId) where.empleadoId = empleadoId;
    if (turno) where.turno = turno;
    if (fecha) {
      const fechaInicio = new Date(fecha);
      fechaInicio.setHours(0, 0, 0, 0);
      const fechaFin = new Date(fecha);
      fechaFin.setHours(23, 59, 59, 999);
      where.fecha = { gte: fechaInicio, lte: fechaFin };
    }

    const asistencias = await db.asistencia.findMany({
      where,
      include: { empleado: true },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(asistencias);
  } catch (error) {
    console.error('Error al obtener asistencias:', error);
    return NextResponse.json({ error: 'Error al obtener asistencias' }, { status: 500 });
  }
}

// POST - Registrar entrada/salida
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { codigoQr, metodo = 'qr', empleadoId: manualEmpleadoId } = data;

    console.log('Datos recibidos:', { codigoQr, metodo, manualEmpleadoId });

    // Buscar empleado por QR o por ID (para registro manual)
    let empleado;
    if (codigoQr) {
      empleado = await db.empleado.findUnique({
        where: { codigoQr }
      });
      console.log('Buscando por codigoQr:', codigoQr, 'Resultado:', empleado ? 'Encontrado' : 'No encontrado');
    } else if (manualEmpleadoId) {
      empleado = await db.empleado.findUnique({
        where: { id: manualEmpleadoId }
      });
    }

    if (!empleado) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    if (empleado.estado !== 'activo') {
      return NextResponse.json({
        error: `Empleado ${empleado.estado === 'vacaciones' ? 'de vacaciones' : empleado.estado === 'licencia' ? 'con licencia' : 'inactivo'}`
      }, { status: 400 });
    }

    // Obtener configuración
    const config = await db.configuracion.findUnique({
      where: { id: 'default' }
    });

    const ahora = new Date();
    const horaActual = ahora.toTimeString().slice(0, 5);

    // Crear fecha de hoy en UTC para comparación
    const fechaHoy = new Date();
    fechaHoy.setUTCHours(0, 0, 0, 0);

    console.log('Buscando última asistencia para empleado:', empleado.id, 'fecha >=', fechaHoy);

    // Buscar última asistencia del día de hoy
    const ultimaAsistencia = await db.asistencia.findFirst({
      where: {
        empleadoId: empleado.id,
        fecha: { gte: fechaHoy }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log('Última asistencia encontrada:', ultimaAsistencia);

    // PROTECCIÓN CONTRA DUPLICADOS: Verificar si hay una asistencia muy reciente (menos de 3 segundos)
    if (ultimaAsistencia) {
      const tiempoDesdeUltima = ahora.getTime() - new Date(ultimaAsistencia.createdAt).getTime();
      if (tiempoDesdeUltima < 3000) {
        console.log('DUPLICADO DETECTADO: última asistencia hace', tiempoDesdeUltima, 'ms');
        return NextResponse.json({
          error: 'Espere unos segundos antes de escanear de nuevo',
          duplicado: true
        }, { status: 429 });
      }
    }

    // Determinar si es entrada o salida
    // Si no hay asistencia previa O la última fue salida -> ENTRADA
    // Si la última fue entrada -> SALIDA
    let tipo = 'entrada';
    if (ultimaAsistencia && ultimaAsistencia.tipo === 'entrada') {
      tipo = 'salida';
    }

    console.log('Tipo determinado:', tipo);

    // Determinar estado (puntual, tardanza)
    let estado = 'puntual';
    if (tipo === 'entrada') {
      const horaEntradaEsperada = empleado.turno === 'nocturno'
        ? (config?.horaEntradaNocturno || '18:00')
        : (config?.horaEntradaDiurno || empleado.horaEntrada || '08:00');

      if (config && esTardanza(horaActual, horaEntradaEsperada, config.toleranciaMinutos)) {
        estado = 'tardanza';
      }
    }

    // Calcular horas trabajadas si es salida
    let horasTrabajadas = null;
    if (tipo === 'salida' && ultimaAsistencia) {
      horasTrabajadas = calcularHorasTrabajadas(ultimaAsistencia.hora, horaActual);
    }

    console.log('Creando asistencia:', { empleadoId: empleado.id, tipo, hora: horaActual, estado });

    // Crear asistencia
    const asistencia = await db.asistencia.create({
      data: {
        empleadoId: empleado.id,
        tipo,
        fecha: ahora,
        hora: horaActual,
        turno: empleado.turno,
        estado,
        metodo,
        horasTrabajadas,
        notas: data.notas || null
      },
      include: { empleado: true }
    });

    console.log('Asistencia creada:', asistencia);

    // Enviar notificaciones por Telegram
    if (config?.telegramToken) {
      const fechaStr = ahora.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const tipoEmoji = tipo === 'entrada' ? '🟢' : '🔴';
      const estadoTexto = estado === 'tardanza' ? ' ⚠️ TARDANZA' : '';

      // Notificar al empleado si tiene chatId
      if (empleado.telegramChatId && empleado.recibirNotificaciones) {
        const mensajeEmpleado = `
${tipoEmoji} <b>${tipo === 'entrada' ? 'ENTRADA' : 'SALIDA'} REGISTRADA</b>

👤 <b>${empleado.nombre} ${empleado.apellido}</b>
📋 Cargo: ${empleado.cargo}
🕐 Hora: ${horaActual}
📅 ${fechaStr}
${tipo === 'salida' && horasTrabajadas ? `⏱️ Horas trabajadas: ${horasTrabajadas.toFixed(1)}h` : ''}${estadoTexto}

<b>Estado laboral:</b> ${empleado.estado.toUpperCase()}
        `;
        await enviarTelegram(config.telegramToken, empleado.telegramChatId, mensajeEmpleado);
      }

      // Notificar al dueño/encargado
      if (config.telegramChatIdDueno) {
        const mensajeDueno = `
${tipoEmoji} <b>${tipo === 'entrada' ? 'ENTRADA' : 'SALIDA'}</b>

👤 ${empleado.nombre} ${empleado.apellido}
📋 ${empleado.cargo}${empleado.departamento ? ` - ${empleado.departamento}` : ''}
🕐 ${horaActual} | ${empleado.turno.toUpperCase()}${estadoTexto}
${tipo === 'salida' && horasTrabajadas ? `⏱️ ${horasTrabajadas.toFixed(1)}h trabajadas` : ''}
        `;
        await enviarTelegram(config.telegramToken, config.telegramChatIdDueno, mensajeDueno);
      }
    }

    // Enviar email de notificación al jefe
    if (config?.notificarEntradaJefe && config?.emailDueno) {
      await enviarEmailNotificacionJefe(
        config.emailDueno,
        config.nombreEmpresa,
        {
          nombre: empleado.nombre,
          apellido: empleado.apellido,
          cargo: empleado.cargo,
          departamento: empleado.departamento,
          turno: empleado.turno
        },
        tipo,
        horaActual,
        estado,
        horasTrabajadas
      );
    }

    return NextResponse.json({
      success: true,
      asistencia,
      empleado: {
        nombre: empleado.nombre,
        apellido: empleado.apellido,
        cargo: empleado.cargo,
        turno: empleado.turno
      }
    });
  } catch (error) {
    console.error('Error al registrar asistencia:', error);
    return NextResponse.json({ error: 'Error al registrar asistencia' }, { status: 500 });
  }
}

// DELETE - Borrar historial
export async function DELETE(request: NextRequest) {
  try {
    const { pin, confirmar } = await request.json();

    // Verificar PIN (por defecto 1234)
    const pinCorrecto = pin === '1234';

    if (!pinCorrecto) {
      return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 });
    }

    if (!confirmar) {
      return NextResponse.json({
        mensaje: '¿Está seguro de borrar todo el historial? Esta acción no se puede deshacer.',
        requiereConfirmacion: true
      });
    }

    // Borrar todas las asistencias
    await db.asistencia.deleteMany();

    return NextResponse.json({ success: true, mensaje: 'Historial borrado correctamente' });
  } catch (error) {
    console.error('Error al borrar historial:', error);
    return NextResponse.json({ error: 'Error al borrar historial' }, { status: 500 });
  }
}
