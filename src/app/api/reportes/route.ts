import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Obtener reportes y estadísticas
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tipo = searchParams.get('tipo') || 'resumen';
    const fechaInicio = searchParams.get('fechaInicio');
    const fechaFin = searchParams.get('fechaFin');
    const empleadoId = searchParams.get('empleadoId');

    // Fechas por defecto: hoy
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (tipo === 'resumen') {
      // Resumen del día
      const asistenciasHoy = await db.asistencia.findMany({
        where: {
          fecha: { gte: hoy }
        },
        include: { empleado: true }
      });

      const empleadosActivos = await db.empleado.count({
        where: { estado: 'activo' }
      });

      const entradas = asistenciasHoy.filter(a => a.tipo === 'entrada').length;
      const salidas = asistenciasHoy.filter(a => a.tipo === 'salida').length;
      const tardanzas = asistenciasHoy.filter(a => a.estado === 'tardanza').length;

      // Empleados que han marcado entrada hoy
      const empleadosPresentes = new Set(
        asistenciasHoy.filter(a => a.tipo === 'entrada').map(a => a.empleadoId)
      );

      return NextResponse.json({
        totalEmpleados: empleadosActivos,
        presentes: empleadosPresentes.size,
        ausentes: empleadosActivos - empleadosPresentes.size,
        entradas,
        salidas,
        tardanzas
      });
    }

    if (tipo === 'detalle') {
      // Reporte detallado por rango de fechas
      const where: Record<string, unknown> = {};

      if (fechaInicio && fechaFin) {
        const inicio = new Date(fechaInicio);
        inicio.setHours(0, 0, 0, 0);
        const fin = new Date(fechaFin);
        fin.setHours(23, 59, 59, 999);
        where.fecha = { gte: inicio, lte: fin };
      }

      if (empleadoId) {
        where.empleadoId = empleadoId;
      }

      const asistencias = await db.asistencia.findMany({
        where,
        include: { empleado: true },
        orderBy: [{ fecha: 'desc' }, { hora: 'desc' }]
      });

      return NextResponse.json(asistencias);
    }

    if (tipo === 'empleado') {
      // Reporte de un empleado específico
      if (!empleadoId) {
        return NextResponse.json({ error: 'ID de empleado requerido' }, { status: 400 });
      }

      const empleado = await db.empleado.findUnique({
        where: { id: empleadoId },
        include: {
          asistencias: {
            orderBy: { fecha: 'desc' },
            take: 30
          }
        }
      });

      if (!empleado) {
        return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
      }

      // Calcular estadísticas
      const totalAsistencias = empleado.asistencias.length;
      const entradas = empleado.asistencias.filter(a => a.tipo === 'entrada').length;
      const tardanzas = empleado.asistencias.filter(a => a.estado === 'tardanza').length;
      const horasTotales = empleado.asistencias
        .filter(a => a.horasTrabajadas)
        .reduce((acc, a) => acc + (a.horasTrabajadas || 0), 0);

      return NextResponse.json({
        empleado,
        estadisticas: {
          totalAsistencias,
          entradas,
          tardanzas,
          horasTotales: horasTotales.toFixed(1)
        }
      });
    }

    return NextResponse.json({ error: 'Tipo de reporte no válido' }, { status: 400 });
  } catch (error) {
    console.error('Error al obtener reportes:', error);
    return NextResponse.json({ error: 'Error al obtener reportes' }, { status: 500 });
  }
}
