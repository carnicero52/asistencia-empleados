import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

// GET - Listar empleados
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const estado = searchParams.get('estado');
    const turno = searchParams.get('turno');

    const where: Record<string, unknown> = {};
    if (estado) where.estado = estado;
    if (turno) where.turno = turno;

    const empleados = await db.empleado.findMany({
      where,
      include: {
        _count: {
          select: { asistencias: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(empleados);
  } catch (error) {
    console.error('Error al obtener empleados:', error);
    return NextResponse.json({ error: 'Error al obtener empleados' }, { status: 500 });
  }
}

// POST - Crear empleado
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Generar código único y QR
    const codigo = `EMP-${Date.now().toString(36).toUpperCase()}`;
    const codigoQr = nanoid(16);

    const empleado = await db.empleado.create({
      data: {
        codigo,
        nombre: data.nombre,
        apellido: data.apellido,
        telefono: data.telefono || null,
        email: data.email || null,
        cargo: data.cargo,
        departamento: data.departamento || null,
        turno: data.turno || 'diurno',
        codigoQr,
        estado: data.estado || 'activo',
        horaEntrada: data.horaEntrada || '08:00',
        horaSalida: data.horaSalida || '17:00',
        telegramChatId: data.telegramChatId || null,
        recibirNotificaciones: data.recibirNotificaciones ?? true
      }
    });

    return NextResponse.json(empleado);
  } catch (error) {
    console.error('Error al crear empleado:', error);
    return NextResponse.json({ error: 'Error al crear empleado' }, { status: 500 });
  }
}

// PUT - Actualizar empleado
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();

    if (!data.id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    const empleado = await db.empleado.update({
      where: { id: data.id },
      data: {
        nombre: data.nombre,
        apellido: data.apellido,
        telefono: data.telefono || null,
        email: data.email || null,
        cargo: data.cargo,
        departamento: data.departamento || null,
        turno: data.turno,
        estado: data.estado,
        horaEntrada: data.horaEntrada,
        horaSalida: data.horaSalida,
        telegramChatId: data.telegramChatId || null,
        recibirNotificaciones: data.recibirNotificaciones
      }
    });

    return NextResponse.json(empleado);
  } catch (error) {
    console.error('Error al actualizar empleado:', error);
    return NextResponse.json({ error: 'Error al actualizar empleado' }, { status: 500 });
  }
}

// DELETE - Eliminar empleado
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    // Eliminar asistencias relacionadas primero
    await db.asistencia.deleteMany({
      where: { empleadoId: id }
    });

    await db.empleado.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar empleado:', error);
    return NextResponse.json({ error: 'Error al eliminar empleado' }, { status: 500 });
  }
}
